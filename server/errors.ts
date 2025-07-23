export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class NetworkError extends Error {
  public statusCode?: number;
  public responseBody?: string;
  
  constructor(message: string, statusCode?: number, responseBody?: string) {
    super(message);
    this.name = "NetworkError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export class ValidationError extends Error {
  public validationDetails?: any;
  
  constructor(message: string, validationDetails?: any) {
    super(message);
    this.name = "ValidationError";
    this.validationDetails = validationDetails;
  }
}

export class APIIntegrationError extends Error {
  public service?: string;
  public errorCode?: string;
  public responseData?: any;
  
  constructor(message: string, service?: string, errorCode?: string, responseData?: any) {
    super(message);
    this.name = "APIIntegrationError";
    this.service = service;
    this.errorCode = errorCode;
    this.responseData = responseData;
  }
}
