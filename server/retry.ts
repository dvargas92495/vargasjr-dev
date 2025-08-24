function isRetryableError(error: any): boolean {
  if (error.name === "TypeError" && error.message.includes("fetch")) {
    return true;
  }

  if (error.message && error.message.includes("GitHub API error")) {
    const statusMatch = error.message.match(/GitHub API error: (\d+)/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1]);
      return status >= 500 || status === 429;
    }
    return true;
  }

  return false;
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        break;
      }

      const isRetryable = isRetryableError(error);
      if (!isRetryable) {
        break;
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
