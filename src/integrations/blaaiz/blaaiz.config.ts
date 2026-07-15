export type BlaaizEnv = "dev" | "prod";

const resolveEnv = (): BlaaizEnv => (process.env.BLAAIZ_ENV === "prod" ? "prod" : "dev");
const resolveBaseUrl = (env: BlaaizEnv) =>
  env === "prod" ? "https://api-prod.blaaiz.com" : "https://api-dev.blaaiz.com";

export const getBlaaizConfig = () => {
  const env = resolveEnv();
  const clientId = process.env.BLAAIZ_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.BLAAIZ_CLIENT_SECRET?.trim() || "";
  const staticAccessToken = process.env.BLAAIZ_ACCESS_TOKEN?.trim() || "";
  const webhookSecret = process.env.BLAAIZ_WEBHOOK_SECRET?.trim() || "";

  return {
    env,
    baseUrl: resolveBaseUrl(env),
    clientId,
    clientSecret,
    staticAccessToken,
    webhookSecret,
    configured: Boolean((clientId && clientSecret) || staticAccessToken),

    // Paths
    tokenPath: "/oauth/token",
    customerPath: "/api/external/customer",
    walletsPath: "/api/external/wallet",
    vbaPath: "/api/external/virtual-bank-account",
    collectionsPath: "/api/external/collection",
    payoutsPath: "/api/external/payout",
    transactionsPath: "/api/external/transaction",
    feesPath: "/api/external/fees/breakdown",
    ratesPath: "/api/external/rate",
    banksPath: "/api/external/bank",
  };
};
