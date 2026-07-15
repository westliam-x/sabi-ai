import { whatsappService } from "../integrations/twilio/whatsapp.service";
import { whisperService } from "../integrations/openai/whisper.service";
import { handleOnboarding } from "./onboarding.service";
import { runSabiAgent } from "../agent/sabi.agent";
import { logger } from "../utils/logger";

export interface IncomingWhatsAppMessage {
  from: string;           // E.164 phone number (without "whatsapp:" prefix)
  body?: string;          // Text content
  mediaUrl?: string;      // Voice note / image URL
  mediaContentType?: string;
  numMedia?: number;
}

export const processMessage = async (msg: IncomingWhatsAppMessage): Promise<void> => {
  const { from } = msg;
  let text = (msg.body || "").trim();

  try {
    // Handle voice notes — transcribe via Whisper
    if (msg.numMedia && msg.numMedia > 0 && msg.mediaUrl) {
      const isVoice =
        msg.mediaContentType?.includes("audio") || msg.mediaContentType?.includes("ogg");

      if (isVoice) {
        logger.info("message.voice_note", { from });
        const buffer = await whatsappService.downloadMedia(msg.mediaUrl);
        text = await whisperService.transcribe(buffer, msg.mediaContentType);
        logger.info("message.transcribed", { from, text: text.slice(0, 80) });
      } else {
        // Image or other media — acknowledge but note limitation
        await whatsappService.send(from, "I received your file but I can only read voice notes and text for now. What would you like to do?");
        return;
      }
    }

    if (!text) {
      await whatsappService.send(from, "I didn't catch that. Can you send a text or voice note?");
      return;
    }

    // Check onboarding state
    const onboardingResult = await handleOnboarding(from, text);

    if (!onboardingResult.done) {
      await whatsappService.send(from, onboardingResult.prompt);
      return;
    }

    // Fully onboarded — run the agent
    const reply = await runSabiAgent(onboardingResult.business, text);
    await whatsappService.send(from, reply);

  } catch (err) {
    logger.error("message.processing_failed", { from, err });
    await whatsappService
      .send(from, "Something went wrong on my end. Please try again in a moment.")
      .catch(() => {});
  }
};
