export class AppError extends Error {
  statusCode: number;
  details: string[] | null;

  constructor(message: string, statusCode = 500, details: string[] | null = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}
