import twilio from "twilio";
import { logger } from "../../utils/logger";

const getClient = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio credentials not configured");
  return twilio(sid, token);
};

const normalize = (num: string) =>
  num.startsWith("whatsapp:") ? num : `whatsapp:${num}`;

export const whatsappService = {
  send: async (to: string, body: string): Promise<string> => {
    const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
    const client = getClient();

    const msg = await client.messages.create({
      from: normalize(from),
      to: normalize(to),
      body: body.trim(),
    });

    logger.info("whatsapp.sent", { to, sid: msg.sid });
    return msg.sid;
  },

  /** Download a media file (voice note, image) from Twilio and return buffer */
  downloadMedia: async (mediaUrl: string): Promise<Buffer> => {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const token = process.env.TWILIO_AUTH_TOKEN!;
    const res = await fetch(mediaUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      },
    });
    if (!res.ok) throw new Error(`Media download failed: ${res.status}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  },
};
