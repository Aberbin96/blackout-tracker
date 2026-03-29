import { withRetry } from "../../utils/supabase-retry";

async function testRetrySuccess() {
  console.log(">>> Test: Success after 2 failures");
  let attempts = 0;
  
  const operation = async () => {
    attempts++;
    if (attempts <= 2) {
      return { data: null, error: { message: "502 Bad Gateway" } };
    }
    return { data: "Success!", error: null };
  };

  const result = await withRetry(operation, { 
    maxRetries: 3, 
    initialDelayMs: 100, // Short delay for testing
    operationName: "Test Operation" 
  });

  if (result.data === "Success!" && attempts === 3) {
    console.log("[PASS] Successfully retried and got data after 3 attempts.");
  } else {
    console.error(`[FAIL] Expected 3 attempts and success, but got ${attempts} attempts and result:`, result);
  }
}

async function testRetryFinalFailure() {
  console.log("\n>>> Test: Final failure after all retries");
  let attempts = 0;
  
  const operation = async () => {
    attempts++;
    return { data: null, error: { message: "502 Permanent Error" } };
  };

  const result = await withRetry(operation, { 
    maxRetries: 2, 
    initialDelayMs: 100, 
    operationName: "Failed Operation" 
  });

  if (result.error && attempts === 3) {
    console.log("[PASS] Correctly failed after 3 attempts (1 initial + 2 retries).");
  } else {
    console.error(`[FAIL] Expected 3 attempts and failure, but got ${attempts} attempts and result:`, result);
  }
}

async function runTests() {
  await testRetrySuccess();
  await testRetryFinalFailure();
}

runTests();
