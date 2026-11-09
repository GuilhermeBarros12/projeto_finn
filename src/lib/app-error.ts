export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400, options?: ErrorOptions) {
    super(message, options);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}
