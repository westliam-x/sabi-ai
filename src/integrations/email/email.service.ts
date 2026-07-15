import nodemailer from "nodemailer";
import { logger } from "../../utils/logger";

const getTransport = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const emailService = {
  send: async (opts: SendEmailOptions): Promise<void> => {
    const from = process.env.EMAIL_FROM || "Sabi <noreply@sabi.africa>";
    const transport = getTransport();

    const info = await transport.sendMail({ from, ...opts });
    logger.info("email.sent", { to: opts.to, messageId: info.messageId });
  },

  /** Quick helper: send an order-ready notification to a customer */
  sendOrderReady: async (opts: {
    customerEmail: string;
    customerName: string;
    businessName: string;
    orderDescription: string;
    balanceDue: number;
  }) => {
    await emailService.send({
      to: opts.customerEmail,
      subject: `Your order from ${opts.businessName} is ready!`,
      text: [
        `Hi ${opts.customerName},`,
        ``,
        `Your order (${opts.orderDescription}) is ready for pickup or delivery.`,
        opts.balanceDue > 0
          ? `Please note that a balance of ₦${opts.balanceDue.toLocaleString()} is outstanding.`
          : `Your payment is complete — thank you!`,
        ``,
        `– ${opts.businessName} via Sabi`,
      ].join("\n"),
    });
  },

  /** Send a payment reminder to a customer */
  sendPaymentReminder: async (opts: {
    customerEmail: string;
    customerName: string;
    businessName: string;
    orderDescription: string;
    balanceDue: number;
  }) => {
    await emailService.send({
      to: opts.customerEmail,
      subject: `Payment reminder from ${opts.businessName}`,
      text: [
        `Hi ${opts.customerName},`,
        ``,
        `This is a reminder that you have an outstanding balance of ₦${opts.balanceDue.toLocaleString()} for your order (${opts.orderDescription}).`,
        ``,
        `Please reach out to arrange payment at your earliest convenience.`,
        ``,
        `– ${opts.businessName} via Sabi`,
      ].join("\n"),
    });
  },
};
