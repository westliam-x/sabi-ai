import { getBlaaizConfig } from "./blaaiz.config";
import { logger } from "../../utils/logger";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
const BUFFER_MS = 60_000;

export const getBlaaizAccessToken = async (): Promise<string> => {
  const cfg = getBlaaizConfig();

  if (cfg.staticAccessToken) return cfg.staticAccessToken;

  if (cachedToken && Date.now() < tokenExpiresAt - BUFFER_MS) return cachedToken;

  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error("Blaaiz OAuth not configured — set BLAAIZ_CLIENT_ID and BLAAIZ_CLIENT_SECRET");
  }

  const res = await fetch(`${cfg.baseUrl}${cfg.tokenPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
  });

  if (!res.ok) {
    logger.error("blaaiz.auth_failed", { status: res.status });
    throw new Error(`Blaaiz token fetch failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;

  logger.info("blaaiz.token_refreshed");
  return cachedToken;
};
