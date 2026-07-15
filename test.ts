/**
 * Quick agent smoke test — run with:
 *   npx ts-node test.ts
 *
 * Simulates a WhatsApp conversation without Twilio.
 */
import "dotenv/config";
import { connectDB } from "./src/db/mongo";
import { handleOnboarding } from "./src/services/onboarding.service";
import { runSabiAgent } from "./src/agent/sabi.agent";
import { Business } from "./src/models/Business";

const TEST_PHONE = "+2348000000001"; // fake test number

const say = async (text: string) => {
  console.log(`\n👤 User: ${text}`);
  const onboarding = await handleOnboarding(TEST_PHONE, text);
  if (!onboarding.done) {
    console.log(`🤖 Sabi: ${onboarding.prompt}`);
    return;
  }
  const reply = await runSabiAgent(onboarding.business, text);
  console.log(`🤖 Sabi: ${reply}`);
};

const run = async () => {
  await connectDB();

  // Clean up previous test run
  await Business.deleteOne({ phoneNumber: TEST_PHONE });

  // Simulate onboarding
  await say("Hi");
  await say("Amaka Okafor");
  await say("Tailoring");
  await say("Amaka Fashion House");

  // Now test the agent
  await say("Tunde ordered 2 natives, I collected 15k deposit, total is 35k, delivery in 2 weeks");
  await say("How much is Tunde's balance?");
  await say("How is my business this week?");

  process.exit(0);
};

run().catch((err) => { console.error(err); process.exit(1); });
