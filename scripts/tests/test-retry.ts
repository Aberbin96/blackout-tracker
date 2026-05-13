import { withRetry } from "../../utils/retry";

async function testRetrySuccess() {
  console.log(">>> Test: Success after 2 failures");
  let attempts = 0;

  try {
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts <= 2) throw new Error("502 Bad Gateway");
        return "Success!";
      },
      { maxRetries: 3, initialDelayMs: 100, operationName: "Test Operation" },
    );

    if (result === "Success!" && attempts === 3) {
      console.log("[PASS] Successfully retried and got data after 3 attempts.");
    } else {
      console.error(`[FAIL] Expected 3 attempts and success, but got ${attempts} attempts and result:`, result);
    }
  } catch (err) {
    console.error(`[FAIL] Unexpected error:`, err);
  }
}

async function testRetryFinalFailure() {
  console.log("\n>>> Test: Final failure after all retries");
  let attempts = 0;

  try {
    await withRetry(
      async () => {
        attempts++;
        throw new Error("502 Permanent Error");
      },
      { maxRetries: 2, initialDelayMs: 100, operationName: "Failed Operation" },
    );
    console.error(`[FAIL] Expected error to be thrown.`);
  } catch {
    if (attempts === 3) {
      console.log("[PASS] Correctly failed after 3 attempts (1 initial + 2 retries).");
    } else {
      console.error(`[FAIL] Expected 3 attempts but got ${attempts}.`);
    }
  }
}

async function runTests() {
  await testRetrySuccess();
  await testRetryFinalFailure();
}

runTests();
