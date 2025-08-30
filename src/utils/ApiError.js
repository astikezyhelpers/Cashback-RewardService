class ApiError extends Error {
  constructor(statusCode, message = "UNKNOWN_ERROR", code = "INTERNAL_ERROR", details = []) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.success = false;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export {ApiError};