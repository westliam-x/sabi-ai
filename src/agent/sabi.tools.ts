import Anthropic from "@anthropic-ai/sdk";
import mongoose from "mongoose";
import { Business, IBusiness } from "../models/Business";
import { Customer } from "../models/Customer";
import { Order } from "../models/Order";
import { Payment } from "../models/Payment";
import { whatsappService } from "../integrations/twilio/whatsapp.service";
import { emailService } from "../integrations/email/email.service";
import { blaaizClient } from "../integrations/blaaiz/blaaiz.client";
import { logger } from "../utils/logger";

// ── Tool definitions for Claude ─────────────────────────────────────────
export const SABI_TOOLS: Anthropic.Tool[] = [
  {
    name: "create_customer",
    description: "Create a new customer record for the business",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Customer's full name" },
        phone_number: { type: "string", description: "Customer WhatsApp/phone number" },
        email: { type: "string", description: "Customer email (optional)" },
        notes: { type: "string", description: "Any extra notes about this customer" },
      },
      required: ["name"],
    },
  },
  {
    name: "log_order",
    description: "Log a new customer order",
    input_schema: {
      type: "object",
      properties: {
        customer_name: { type: "string", description: "Name of the customer" },
        description: { type: "string", description: "What was ordered (e.g. '2 native, 1 kaftan')" },
        total_amount: { type: "number", description: "Total price in NGN" },
        deposit_paid: { type: "number", description: "Deposit collected so far (0 if none)" },
        delivery_date: { type: "string", description: "Expected delivery date (ISO string or natural language)" },
        measurements: { type: "string", description: "Measurements note (optional, tailor-specific)" },
        fabric: { type: "string", description: "Fabric description (optional, tailor-specific)" },
      },
      required: ["customer_name", "description", "total_amount"],
    },
  },
  {
    name: "log_payment",
    description: "Record a payment received for an order",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "The order ID" },
        amount: { type: "number", description: "Amount received in NGN" },
        method: { type: "string", enum: ["cash", "transfer", "blaaiz", "pos", "other"] },
        type: { type: "string", enum: ["deposit", "balance", "full", "refund"] },
        note: { type: "string", description: "Optional note" },
      },
      required: ["order_id", "amount", "method", "type"],
    },
  },
  {
    name: "list_orders",
    description: "List orders for this business with optional filters",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pending", "in_progress", "ready", "delivered", "all"],
          description: "Filter by status",
        },
        customer_name: { type: "string", description: "Filter by customer name (partial match)" },
        limit: { type: "number", description: "Max results to return (default 10)" },
      },
      required: [],
    },
  },
  {
    name: "update_order_status",
    description: "Update the status of an order (e.g. mark as ready, delivered)",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string" },
        status: { type: "string", enum: ["pending", "in_progress", "ready", "delivered", "cancelled"] },
      },
      required: ["order_id", "status"],
    },
  },
  {
    name: "get_business_summary",
    description: "Get a summary of the business: total orders, revenue, outstanding balances",
    input_schema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["today", "week", "month", "all"], description: "Time period" },
      },
      required: ["period"],
    },
  },
  {
    name: "send_whatsapp_to_customer",
    description: "Send a WhatsApp message to a customer on behalf of the business owner",
    input_schema: {
      type: "object",
      properties: {
        customer_phone: { type: "string", description: "Customer phone number" },
        message: { type: "string", description: "The message to send" },
      },
      required: ["customer_phone", "message"],
    },
  },
  {
    name: "send_email_to_customer",
    description: "Send an email to a customer",
    input_schema: {
      type: "object",
      properties: {
        customer_email: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["customer_email", "subject", "body"],
    },
  },
  {
    name: "check_wallet_balance",
    description: "Check the current Blaaiz wallet balance for the business",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "create_payment_link",
    description: "Generate a Blaaiz payment collection link to send to a customer",
    input_schema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Amount in NGN" },
        customer_name: { type: "string" },
        reference: { type: "string", description: "Unique reference (e.g. order ID)" },
      },
      required: ["amount", "customer_name", "reference"],
    },
  },
  {
    name: "get_exchange_rate",
    description: "Get the current exchange rate (e.g. USD to NGN)",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Source currency (e.g. USD, GBP)" },
        to: { type: "string", description: "Target currency (default: NGN)" },
      },
      required: ["from"],
    },
  },
];

// ── Tool execution ──────────────────────────────────────────────────────
export const executeTool = async (
  toolName: string,
  input: Record<string, unknown>,
  business: IBusiness
): Promise<string> => {
  const bizId = business._id as mongoose.Types.ObjectId;

  try {
    switch (toolName) {
      case "create_customer": {
        const customer = await Customer.create({
          businessId: bizId,
          name: input.name,
          phoneNumber: input.phone_number,
          email: input.email,
          notes: input.notes,
        });
        return JSON.stringify({ success: true, customer_id: customer._id, name: customer.name });
      }

      case "log_order": {
        // Find or create customer
        let customer = await Customer.findOne({ businessId: bizId, name: new RegExp(input.customer_name as string, "i") });
        if (!customer) {
          customer = await Customer.create({ businessId: bizId, name: input.customer_name });
        }

        const deliveryDate = input.delivery_date ? new Date(input.delivery_date as string) : undefined;

        const order = await Order.create({
          businessId: bizId,
          customerId: customer._id,
          customerName: customer.name,
          description: input.description,
          totalAmount: input.total_amount,
          depositPaid: input.deposit_paid || 0,
          measurements: input.measurements,
          fabric: input.fabric,
          deliveryDate,
          status: "pending",
        });

        return JSON.stringify({
          success: true,
          order_id: order._id,
          customer: customer.name,
          description: order.description,
          total: order.totalAmount,
          deposit: order.depositPaid,
          balance_due: order.balanceDue,
          delivery: order.deliveryDate?.toDateString() || "not set",
        });
      }

      case "log_payment": {
        const order = await Order.findOne({ _id: input.order_id, businessId: bizId });
        if (!order) return JSON.stringify({ error: "Order not found" });

        await Payment.create({
          businessId: bizId,
          orderId: order._id,
          customerId: order.customerId,
          customerName: order.customerName,
          amount: input.amount,
          method: input.method,
          type: input.type,
          note: input.note,
        });

        order.depositPaid = Math.min(order.totalAmount, order.depositPaid + (input.amount as number));
        await order.save();

        return JSON.stringify({
          success: true,
          new_deposit_total: order.depositPaid,
          balance_due: order.balanceDue,
          fully_paid: order.balanceDue === 0,
        });
      }

      case "list_orders": {
        const query: Record<string, unknown> = { businessId: bizId };
        if (input.status && input.status !== "all") query.status = input.status;
        if (input.customer_name) query.customerName = new RegExp(input.customer_name as string, "i");

        const orders = await Order.find(query)
          .sort({ createdAt: -1 })
          .limit((input.limit as number) || 10)
          .lean();

        return JSON.stringify(
          orders.map((o) => ({
            id: o._id,
            customer: o.customerName,
            description: o.description,
            total: o.totalAmount,
            paid: o.depositPaid,
            balance: o.balanceDue,
            status: o.status,
            delivery: o.deliveryDate?.toDateString() || "—",
          }))
        );
      }

      case "update_order_status": {
        const order = await Order.findOneAndUpdate(
          { _id: input.order_id, businessId: bizId },
          { status: input.status, ...(input.status === "delivered" ? { deliveredAt: new Date() } : {}) },
          { new: true }
        );
        if (!order) return JSON.stringify({ error: "Order not found" });
        return JSON.stringify({ success: true, order_id: order._id, new_status: order.status });
      }

      case "get_business_summary": {
        const now = new Date();
        let from: Date;
        switch (input.period) {
          case "today": from = new Date(now.setHours(0, 0, 0, 0)); break;
          case "week": from = new Date(Date.now() - 7 * 86_400_000); break;
          case "month": from = new Date(Date.now() - 30 * 86_400_000); break;
          default: from = new Date(0);
        }

        const [orders, payments] = await Promise.all([
          Order.find({ businessId: bizId, createdAt: { $gte: from } }).lean(),
          Payment.find({ businessId: bizId, createdAt: { $gte: from } }).lean(),
        ]);

        const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
        const outstanding = orders.reduce((s, o) => s + o.balanceDue, 0);

        return JSON.stringify({
          period: input.period,
          total_orders: orders.length,
          revenue_collected: totalRevenue,
          outstanding_balance: outstanding,
          orders_pending: orders.filter((o) => o.status === "pending").length,
          orders_ready: orders.filter((o) => o.status === "ready").length,
          orders_delivered: orders.filter((o) => o.status === "delivered").length,
        });
      }

      case "send_whatsapp_to_customer": {
        await whatsappService.send(input.customer_phone as string, input.message as string);
        return JSON.stringify({ success: true, sent_to: input.customer_phone });
      }

      case "send_email_to_customer": {
        await emailService.send({
          to: input.customer_email as string,
          subject: input.subject as string,
          text: input.body as string,
        });
        return JSON.stringify({ success: true });
      }

      case "check_wallet_balance": {
        if (!business.blaaizWalletId) {
          return JSON.stringify({ error: "No Blaaiz wallet set up for this business yet" });
        }
        const result = await blaaizClient.getWallet(business.blaaizWalletId);
        return JSON.stringify({
          balance: result.data.balance,
          available: result.data.available_balance,
          currency: result.data.currency,
        });
      }

      case "create_payment_link": {
        if (!business.blaaizWalletId || !business.blaaizCustomerId) {
          return JSON.stringify({ error: "Blaaiz wallet not configured for this business" });
        }
        const result = await blaaizClient.createCollection({
          customer_id: business.blaaizCustomerId,
          wallet_id: business.blaaizWalletId,
          amount: input.amount as number,
          currency: "NGN",
          method: "bank_transfer",
          reference: input.reference as string,
        });
        return JSON.stringify({
          success: true,
          checkout_url: result.data.checkout_url,
          reference: input.reference,
        });
      }

      case "get_exchange_rate": {
        const result = await blaaizClient.getRates(input.from as string, (input.to as string) || "NGN");
        return JSON.stringify(result.data);
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (err) {
    logger.error("tool.execution_failed", { toolName, err });
    return JSON.stringify({ error: String(err) });
  }
};
