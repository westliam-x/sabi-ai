import { Business, BusinessVertical, IBusiness } from "../models/Business";
import { blaaizClient } from "../integrations/blaaiz/blaaiz.client";
import { logger } from "../utils/logger";

const VERTICAL_KEYWORDS: Record<string, BusinessVertical> = {
  tailor: "tailor", tailoring: "tailor", fashion: "tailor", sewing: "tailor",
  caterer: "caterer", catering: "caterer", food: "caterer", cook: "caterer",
  logistics: "logistics", delivery: "logistics", dispatch: "logistics", transport: "logistics",
};

const parseVertical = (input: string): BusinessVertical => {
  const lower = input.toLowerCase();
  for (const [keyword, vertical] of Object.entries(VERTICAL_KEYWORDS)) {
    if (lower.includes(keyword)) return vertical;
  }
  return "other";
};

/**
 * Returns { done: false, prompt } while onboarding is in progress.
 * Returns { done: true, business } when complete.
 */
export const handleOnboarding = async (
  phoneNumber: string,
  incomingText: string
): Promise<{ done: false; prompt: string } | { done: true; business: IBusiness }> => {
  let biz = await Business.findOne({ phoneNumber });

  // First contact — create record
  if (!biz) {
    biz = await Business.create({ phoneNumber, onboardingState: "awaiting_name" });
    return {
      done: false,
      prompt: "👋 Welcome to *Sabi*!\n\nI'm your AI business assistant. I'll help you track orders, payments, and customers — all from WhatsApp.\n\nFirst, what's your name?",
    };
  }

  if (biz.onboardingState === "complete") {
    return { done: true, business: biz };
  }

  // Drive the state machine
  switch (biz.onboardingState) {
    case "awaiting_name": {
      biz.ownerName = incomingText.trim();
      biz.onboardingState = "awaiting_vertical";
      await biz.save();
      return {
        done: false,
        prompt: `Nice to meet you, *${biz.ownerName}*! 🙌\n\nWhat type of business do you run?\n\n1. Tailoring / Fashion\n2. Catering / Food\n3. Logistics / Delivery\n4. Other\n\nJust type the number or describe your business.`,
      };
    }

    case "awaiting_vertical": {
      biz.vertical = parseVertical(incomingText) || "other";
      biz.onboardingState = "awaiting_business_name";
      await biz.save();
      return {
        done: false,
        prompt: `Got it — *${biz.vertical}* business. 👍\n\nWhat's the name of your business?`,
      };
    }

    case "awaiting_business_name": {
      biz.businessName = incomingText.trim();
      biz.onboardingState = "complete";
      await biz.save();

      // Provision Blaaiz wallet in the background
      provisionBlaaizWallet(biz).catch((err) =>
        logger.error("onboarding.blaaiz_provision_failed", { phone: phoneNumber, err })
      );

      return {
        done: false,
        prompt: `✅ All set, *${biz.ownerName}*!\n\n*${biz.businessName}* is ready on Sabi.\n\nI'm setting up your payment wallet now — I'll let you know when it's ready.\n\nYou can start talking to me any time. Just say things like:\n• "Tunde ordered 2 native, paid 10k deposit, delivery in 2 weeks"\n• "How much do I have pending?"\n• "Send Tunde a reminder for his balance"\n\nI'll handle the rest. 💪`,
      };
    }

    default:
      return { done: true, business: biz };
  }
};

/** Create a Blaaiz customer + NGN wallet + virtual bank account for the business */
const provisionBlaaizWallet = async (biz: IBusiness) => {
  if (!biz.ownerName || !biz.phoneNumber) return;

  const [firstName, ...rest] = biz.ownerName.split(" ");
  const lastName = rest.join(" ") || "Business";
  const email = `sabi+${biz.phoneNumber.replace("+", "")}@sabi.africa`;

  // Create Blaaiz customer
  const customerRes = await blaaizClient.createCustomer({
    email,
    first_name: firstName,
    last_name: lastName,
    phone_number: biz.phoneNumber,
    country: "NG",
    type: "individual",
  });
  biz.blaaizCustomerId = customerRes.data.id;

  // Create NGN wallet
  const walletRes = await blaaizClient.createWallet(biz.blaaizCustomerId);
  biz.blaaizWalletId = walletRes.data.id;

  // Create virtual bank account
  const vbaRes = await blaaizClient.createVirtualBankAccount(
    biz.blaaizWalletId,
    biz.blaaizCustomerId,
    biz.businessName
  );
  biz.blaaizVirtualAccountNumber = vbaRes.data.account_number;
  biz.blaaizVirtualAccountBank = vbaRes.data.bank_name;

  await biz.save();

  logger.info("onboarding.blaaiz_provisioned", {
    phone: biz.phoneNumber,
    walletId: biz.blaaizWalletId,
    vba: biz.blaaizVirtualAccountNumber,
  });
};
