import OpenAI from "openai";
import { logger } from "../../utils/logger";

const WHISPER_PROMPT = "Nigerian Pidgin English, business context, orders, payments, customers";

const getGroqClient = () => {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not configured");
  return new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1" });
};

const getOpenAIClient = () => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not configured");
  return new OpenAI({ apiKey: key });
};

const buildFile = (audioBuffer: Buffer, mimeType: string) => {
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "wav";
  return new File([audioBuffer], `voice.${ext}`, { type: mimeType });
};

const transcribeWith = async (
  client: OpenAI,
  model: string,
  audioBuffer: Buffer,
  mimeType: string
): Promise<string> => {
  const response = await client.audio.transcriptions.create({
    file: buildFile(audioBuffer, mimeType),
    model,
    language: "en",
    prompt: WHISPER_PROMPT,
  });
  return response.text;
};

export const whisperService = {
  /**
   * Transcribe a voice note buffer.
   * Tries Groq first (free, fast). Falls back to OpenAI if Groq fails or is unavailable.
   */
  transcribe: async (audioBuffer: Buffer, mimeType = "audio/ogg"): Promise<string> => {
    // Try Groq first
    if (process.env.GROQ_API_KEY) {
      try {
        const text = await transcribeWith(getGroqClient(), "whisper-large-v3-turbo", audioBuffer, mimeType);
        logger.info("whisper.transcribed", { provider: "groq", chars: text.length });
        return text;
      } catch (err) {
        logger.warn("whisper.groq_failed_falling_back", { err: String(err) });
      }
    }

    // Fallback to OpenAI
    if (process.env.OPENAI_API_KEY) {
      const text = await transcribeWith(getOpenAIClient(), "whisper-1", audioBuffer, mimeType);
      logger.info("whisper.transcribed", { provider: "openai", chars: text.length });
      return text;
    }

    throw new Error("No transcription provider configured. Set GROQ_API_KEY or OPENAI_API_KEY.");
  },
};
