interface ErrorResponse {
  error: string;
  details?: string;
  code?: string;
  timestamp: string;
  requestId?: string;
  diagnostics?: any;
  troubleshooting?: string[];
}

/** @public */
export function createErrorResponse(
  error: string,
  options: {
    details?: string;
    code?: string;
    requestId?: string;
    diagnostics?: any;
    troubleshooting?: string[];
  } = {}
): ErrorResponse {
  return {
    error,
    timestamp: new Date().toISOString(),
    ...options,
  };
}

/** @public */
export function createNetworkErrorResponse(
  baseMessage: string,
  statusCode?: number,
  responseBody?: string,
  url?: string
): ErrorResponse {
  const diagnostics: any = {};
  const troubleshooting: string[] = [];

  if (statusCode) {
    diagnostics.statusCode = statusCode;
    diagnostics.statusText = getStatusText(statusCode);
  }

  if (responseBody) {
    diagnostics.responseBody = responseBody;
  }

  if (url) {
    diagnostics.requestUrl = url;
  }

  if (statusCode) {
    if (statusCode >= 500) {
      troubleshooting.push("Server error - try again later");
      troubleshooting.push("Check if the target service is operational");
    } else if (statusCode === 404) {
      troubleshooting.push("Verify the endpoint URL is correct");
      troubleshooting.push("Check if the resource exists");
    } else if (statusCode === 401 || statusCode === 403) {
      troubleshooting.push("Check authentication credentials");
      troubleshooting.push("Verify API permissions");
    } else if (statusCode === 429) {
      troubleshooting.push("Rate limit exceeded - wait before retrying");
    }
  } else {
    troubleshooting.push("Check network connectivity");
    troubleshooting.push("Verify the target service is reachable");
  }

  return createErrorResponse(baseMessage, {
    code: statusCode ? `HTTP_${statusCode}` : "NETWORK_ERROR",
    diagnostics,
    troubleshooting,
  });
}

function getStatusText(statusCode: number): string {
  const statusTexts: { [key: number]: string } = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
  };
  return statusTexts[statusCode] || "Unknown Status";
}
