import Anthropic from "@anthropic-ai/sdk";
import { IBusiness } from "../models/Business";
import { Message } from "../models/Message";
import { Order } from "../models/Order";
import { buildSystemPrompt } from "./sabi.system-prompt";
import { SABI_TOOLS, executeTool } from "./sabi.tools";
import { logger } from "../utils/logger";
import mongoose from "mongoose";

const MODEL = process.env.CLAUDE_MODEL?.trim() || "claude-sonnet-4-6";
const HISTORY_LIMIT = 20;

const getClient = () => {
  const key = process.env.CLAUDE_API_KEY;
  if (!key) throw new Error("CLAUDE_API_KEY not configured");
  return new Anthropic({ apiKey: key });
};

/** Build a lightweight snapshot of the business for context injection */
const buildSnapshot = async (business: IBusiness) => {
  const bizId = business._id as mongoose.Types.ObjectId;
  const [pendingOrders, readyOrders, totalOrders] = await Promise.all([
    Order.find({ businessId: bizId, status: "pending" }).sort({ deliveryDate: 1 }).limit(5).lean(),
    Order.find({ businessId: bizId, status: "ready" }).limit(5).lean(),
    Order.countDocuments({ businessId: bizId }),
  ]);

  return {
    business: {
      name: business.businessName,
      owner: business.ownerName,
      vertical: business.vertical,
      wallet_id: business.blaaizWalletId || null,
      virtual_account: business.blaaizVirtualAccountNumber
        ? { number: business.blaaizVirtualAccountNumber, bank: business.blaaizVirtualAccountBank }
        : null,
    },
    pending_orders: pendingOrders.map((o) => ({
      id: o._id,
      customer: o.customerName,
      description: o.description,
      balance_due: o.balanceDue,
      delivery: o.deliveryDate?.toDateString() || "—",
    })),
    ready_orders: readyOrders.map((o) => ({
      id: o._id,
      customer: o.customerName,
      balance_due: o.balanceDue,
    })),
    total_orders: totalOrders,
  };
};

export const runSabiAgent = async (
  business: IBusiness,
  userMessage: string
): Promise<string> => {
  const client = getClient();
  const bizId = business._id as mongoose.Types.ObjectId;

  // Save incoming message
  await Message.create({ businessId: bizId, role: "user", content: userMessage });

  // Load conversation history
  const history = await Message.find({ businessId: bizId })
    .sort({ createdAt: -1 })
    .limit(HISTORY_LIMIT)
    .lean();

  const messages: Anthropic.MessageParam[] = history
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // Snapshot for system prompt
  const snapshot = await buildSnapshot(business);
  const systemPrompt = buildSystemPrompt(business, snapshot);

  // Agentic loop
  let response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    tools: SABI_TOOLS,
    messages,
  });

  logger.info("agent.response", { stop_reason: response.stop_reason });

  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const result = await executeTool(block.name, block.input as Record<string, unknown>, business);
        logger.info("tool.executed", { name: block.name });
        return { type: "tool_result" as const, tool_use_id: block.id, content: result };
      })
    );

    // Continue with tool results
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools: SABI_TOOLS,
      messages: [
        ...messages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ],
    });

    logger.info("agent.tool_loop", { stop_reason: response.stop_reason });
  }

  // Extract final text reply
  const reply = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  // Save assistant reply to history
  await Message.create({ businessId: bizId, role: "assistant", content: reply });

  return reply;
};
