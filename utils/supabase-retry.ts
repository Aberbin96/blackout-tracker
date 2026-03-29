/**
 * Retries a Supabase query (or any async operation returning { data, error }) 
 * with exponential backoff on failure.
 */
export async function withRetry<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    backoffFactor?: number;
    operationName?: string;
  } = {},
): Promise<{ data: T | null; error: any }> {
  const {
    maxRetries = 3,
    initialDelayMs = 2000, // 2 seconds initial delay
    backoffFactor = 2,
    operationName = "Supabase Query",
  } = options;

  let lastError: any = null;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[RETRY] ${operationName}: Attempt ${attempt} (after ${delay}ms delay)...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= backoffFactor; // Exponential backoff
      }

      const result = await operation();

      if (!result.error) {
        return result;
      }

      lastError = result.error;
      
      // Check if error is something we should retry (like 502, 504, 500, or network errors)
      // Supabase error messages for 502/504 often contain the status code or the HTML body.
      const errorMsg = typeof lastError.message === 'string' ? lastError.message : JSON.stringify(lastError);
      
      if (
        errorMsg.includes("502") || 
        errorMsg.includes("504") || 
        errorMsg.includes("500") ||
        errorMsg.includes("fetch") ||
        errorMsg.includes("Bad Gateway") ||
        errorMsg.includes("Gateway Timeout")
      ) {
        console.warn(`[RETRY] ${operationName}: Received retryable error: ${errorMsg.slice(0, 100)}...`);
      } else {
        // For non-transient errors (like auth errors or schema errors), we might want to stop early.
        // But for safety in this monitoring context, we retry all errors unless they are clearly "stop" cases.
        console.warn(`[RETRY] ${operationName}: Received error: ${errorMsg.slice(0, 100)}...`);
      }

    } catch (e: any) {
      lastError = e;
      console.warn(`[RETRY] ${operationName}: Unexpected exception on attempt ${attempt}: ${e.message}`);
    }

    if (attempt === maxRetries + 1) {
      console.error(`[RETRY] ${operationName} FAILED after ${maxRetries} retries.`);
    }
  }

  return { data: null, error: lastError };
}
