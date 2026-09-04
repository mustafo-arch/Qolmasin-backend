import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    code: string,
    message: string,
    details: unknown = null,
  ) {
    super({ code, message, details }, status);
  }
}
