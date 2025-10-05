export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class InvalidContactDataError extends Error {
  constructor(
    message: string = "Cannot create contact: no identifying information provided"
  ) {
    super(message);
    this.name = "InvalidContactDataError";
  }
}

export class InvalidContactFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidContactFormatError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}
