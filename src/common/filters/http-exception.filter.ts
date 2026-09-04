import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly production: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const responseBody =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? exceptionResponse
        : null;
    const message =
      responseBody && 'message' in responseBody
        ? responseBody.message
        : status === 500
          ? 'Internal server error'
          : (exceptionResponse ?? 'Request failed');
    const code =
      responseBody &&
      'code' in responseBody &&
      typeof responseBody.code === 'string'
        ? responseBody.code
        : `HTTP_${status}`;
    const details =
      responseBody && 'details' in responseBody ? responseBody.details : null;

    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `${request.method} ${request.originalUrl} failed [${request.requestId ?? 'no-request-id'}]`,
        this.production ? undefined : stack,
      );
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      details,
      requestId: request.requestId ?? randomUUID(),
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }
}
