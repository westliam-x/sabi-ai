import cron from "node-cron";
import { Order } from "../models/Order";
import { Business } from "../models/Business";
import { whatsappService } from "../integrations/twilio/whatsapp.service";
import { logger } from "../utils/logger";

/** Run every morning at 8am Nigeria time (UTC+1 = 7am UTC) */
const MORNING_CRON = "0 7 * * *";

const formatNGN = (n: number) => `₦${n.toLocaleString()}`;

/**
 * For each business, surface:
 * 1. Orders due in the next 3 days
 * 2. Orders marked "ready" with outstanding balance (unpicked)
 * 3. Orders overdue (delivery date passed, not delivered)
 */
const runDailyBriefing = async () => {
  logger.info("reminders.daily_briefing_start");
  const businesses = await Business.find({ onboardingState: "complete" }).lean();

  for (const biz of businesses) {
    try {
      const now = new Date();
      const in3Days = new Date(Date.now() + 3 * 86_400_000);

      const [dueSoon, readyWithBalance, overdue] = await Promise.all([
        Order.find({
          businessId: biz._id,
          status: { $in: ["pending", "in_progress"] },
          deliveryDate: { $gte: now, $lte: in3Days },
        }).lean(),
        Order.find({
          businessId: biz._id,
          status: "ready",
          balanceDue: { $gt: 0 },
        }).lean(),
        Order.find({
          businessId: biz._id,
          status: { $in: ["pending", "in_progress"] },
          deliveryDate: { $lt: now },
        }).lean(),
      ]);

      if (!dueSoon.length && !readyWithBalance.length && !overdue.length) continue;

      const lines: string[] = [`☀️ Good morning, ${biz.ownerName}! Here's your Sabi update:\n`];

      if (overdue.length) {
        lines.push(`⚠️ *Overdue orders (${overdue.length}):*`);
        overdue.forEach((o) => lines.push(`  • ${o.customerName} — ${o.description} (balance: ${formatNGN(o.balanceDue)})`));
        lines.push("");
      }

      if (dueSoon.length) {
        lines.push(`📅 *Due in the next 3 days (${dueSoon.length}):*`);
        dueSoon.forEach((o) =>
          lines.push(`  • ${o.customerName} — ${o.description} | ${o.deliveryDate?.toDateString()}`)
        );
        lines.push("");
      }

      if (readyWithBalance.length) {
        lines.push(`💰 *Ready but unpaid (${readyWithBalance.length}):*`);
        readyWithBalance.forEach((o) =>
          lines.push(`  • ${o.customerName} — balance ${formatNGN(o.balanceDue)} outstanding`)
        );
      }

      lines.push("\nReply anytime to update an order or send a customer reminder.");

      await whatsappService.send(biz.phoneNumber, lines.join("\n"));
      logger.info("reminders.sent", { phone: biz.phoneNumber });
    } catch (err) {
      logger.error("reminders.send_failed", { phone: biz.phoneNumber, err });
    }
  }

  logger.info("reminders.daily_briefing_done");
};

export const startReminderScheduler = () => {
  cron.schedule(MORNING_CRON, runDailyBriefing, { timezone: "Africa/Lagos" });
  logger.info("reminders.scheduler_started", { cron: MORNING_CRON });
};
