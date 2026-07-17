import { getBlaaizAccessToken } from "./blaaiz.auth";
import { getBlaaizConfig } from "./blaaiz.config";
import { logger } from "../../utils/logger";

// ── Types ───────────────────────────────────────────────────────────────
export interface BlaaizCustomerPayload {
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  country?: string;
  type?: string;
  id_type?: string;
  id_number?: string;
}

export interface BlaaizWallet {
  id: string;
  currency: string;
  balance: number;
  available_balance: number;
}

export interface BlaaizVBA {
  account_number: string;
  bank_name: string;
  account_name: string;
}

export interface BlaaizCollectionPayload {
  customer_id: string;
  wallet_id: string;
  amount: number;
  currency: string;
  method: string;
  reference: string;
  phone_number?: string;
}

export interface BlaaizRate {
  from: string;
  to: string;
  rate: number;
}

// ── Core request ────────────────────────────────────────────────────────
const request = async <T>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {}
): Promise<T> => {
  const cfg = getBlaaizConfig();
  const token = await getBlaaizAccessToken();

  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error("blaaiz.request_failed", { path, status: res.status, body: text });
    throw new Error(`Blaaiz API error ${res.status} on ${path}: ${text}`);
  }

  return res.json() as Promise<T>;
};

// ── Public API ──────────────────────────────────────────────────────────
export const blaaizClient = {
  /** Create a Blaaiz customer record for a new Sabi business owner */
  createCustomer: (payload: BlaaizCustomerPayload) => {
    const cfg = getBlaaizConfig();
    return request<{ data: { id: string } }>(cfg.customerPath, { method: "POST", body: payload });
  },

  /** Create an NGN wallet for the business */
  createWallet: (customerId: string) => {
    const cfg = getBlaaizConfig();
    return request<{ data: BlaaizWallet }>(cfg.walletsPath, {
      method: "POST",
      body: { customer_id: customerId, currency: "NGN" },
    });
  },

  /** Get wallet balance */
  getWallet: (walletId: string) => {
    const cfg = getBlaaizConfig();
    return request<{ data: BlaaizWallet }>(`${cfg.walletsPath}/${walletId}`);
  },

  /** Create a virtual bank account tied to the business wallet */
  createVirtualBankAccount: (walletId: string, customerId: string, accountName: string) => {
    const cfg = getBlaaizConfig();
    return request<{ data: BlaaizVBA }>(cfg.vbaPath, {
      method: "POST",
      body: { wallet_id: walletId, customer_id: customerId, account_name: accountName },
    });
  },

  /** Initiate a collection (payment request) — returns a checkout link */
  createCollection: (payload: BlaaizCollectionPayload) => {
    const cfg = getBlaaizConfig();
    return request<{ data: { id: string; checkout_url?: string } }>(cfg.collectionsPath, {
      method: "POST",
      body: payload,
    });
  },

  /** Get current exchange rates */
  getRates: (from: string, to: string) => {
    const cfg = getBlaaizConfig();
    return request<{ data: BlaaizRate }>(`${cfg.ratesPath}?from=${from}&to=${to}`);
  },

  /** List recent transactions for a wallet */
  getTransactions: (walletId: string, limit = 10) => {
    const cfg = getBlaaizConfig();
    return request<{ data: unknown[] }>(`${cfg.transactionsPath}?wallet_id=${walletId}&limit=${limit}`);
  },

  /** Get supported banks (for payout setup) */
  getBanks: (country = "NG") => {
    const cfg = getBlaaizConfig();
    return request<{ data: Array<{ code: string; name: string }> }>(`${cfg.banksPath}?country=${country}`);
  },
};
