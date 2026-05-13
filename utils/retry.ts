export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    backoffFactor?: number;
    operationName?: string;
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 2000,
    backoffFactor = 2,
    operationName = "DB Query",
  } = options;

  let lastError: any = null;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[RETRY] ${operationName}: Attempt ${attempt} (after ${delay}ms delay)...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= backoffFactor;
      }

      return await operation();
    } catch (e: any) {
      lastError = e;
      const errorMsg = e?.message ?? String(e);
      console.warn(`[RETRY] ${operationName}: Error on attempt ${attempt}: ${errorMsg.slice(0, 100)}`);

      if (attempt === maxRetries + 1) {
        console.error(`[RETRY] ${operationName} FAILED after ${maxRetries} retries.`);
      }
    }
  }

  throw lastError;
}
