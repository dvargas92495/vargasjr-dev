/**
 * Utility for handling EventSource streaming errors with detailed error information
 */

export interface StreamingErrorDetails {
  message: string;
  error: string;
}

/**
 * Handles EventSource onerror events and generates detailed error information
 * @param event - The error event from EventSource.onerror
 * @param eventSource - The EventSource instance
 * @param endpoint - The streaming endpoint URL for context
 * @returns Formatted error details for display
 */
export function handleStreamingError(
  event: Event,
  eventSource: EventSource,
  endpoint: string
): StreamingErrorDetails {
  const errorDetails: string[] = [];

  if (event.type === "error") {
    errorDetails.push("EventSource error occurred");
  }

  if (eventSource.readyState === EventSource.CONNECTING) {
    errorDetails.push(
      "Connection failed - unable to establish connection to streaming endpoint"
    );
  } else if (eventSource.readyState === EventSource.CLOSED) {
    errorDetails.push("Connection closed unexpectedly");
  }

  errorDetails.push(`Endpoint: ${endpoint}`);

  if ("message" in event && typeof event.message === "string") {
    errorDetails.push(`Event message: ${event.message}`);
  }

  const errorMessage =
    errorDetails.length > 0
      ? errorDetails.join(". ")
      : "Failed to connect to streaming endpoint";

  return {
    message: "Connection error occurred",
    error: errorMessage,
  };
}
