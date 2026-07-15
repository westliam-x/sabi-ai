import { Router, Request, Response } from "express";
import { processMessage } from "../services/message.service";
import { logger } from "../utils/logger";

const router = Router();

/**
 * POST /webhook/whatsapp
 * Twilio sends all incoming WhatsApp messages here.
 * Must return 200 quickly — processing is fire-and-forget.
 */
router.post("/", (req: Request, res: Response) => {
  // Respond immediately so Twilio doesn't retry
  res.sendStatus(200);

  const body = req.body;
  const from = (body.From as string || "").replace("whatsapp:", "");
  const text = body.Body as string | undefined;
  const numMedia = Number(body.NumMedia || 0);
  const mediaUrl = numMedia > 0 ? (body.MediaUrl0 as string) : undefined;
  const mediaContentType = numMedia > 0 ? (body.MediaContentType0 as string) : undefined;

  if (!from) {
    logger.warn("whatsapp.webhook.no_from");
    return;
  }

  logger.info("whatsapp.incoming", { from, hasText: Boolean(text), numMedia });

  processMessage({ from, body: text, mediaUrl, mediaContentType, numMedia }).catch((err) =>
    logger.error("whatsapp.process_error", { from, err })
  );
});

export default router;
