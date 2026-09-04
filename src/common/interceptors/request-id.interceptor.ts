import {
  CallHandler,
  ExecutionContext,
  Injectable,
  HttpException,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

type RequestWithId = Request & {
  requestId?: string;
  user?: { sub?: string };
};

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const suppliedRequestId = request.header('x-request-id');
    const requestId =
      suppliedRequestId && /^[a-zA-Z0-9._:-]{1,100}$/.test(suppliedRequestId)
        ? suppliedRequestId
        : randomUUID();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    const startedAt = performance.now();
    return next.handle().pipe(
      tap({
        next: () => this.log(request, response, startedAt),
        error: (error: unknown) =>
          this.log(request, response, startedAt, error),
      }),
    );
  }

  private log(
    request: RequestWithId,
    response: Response,
    startedAt: number,
    error?: unknown,
  ): void {
    const statusCode =
      error instanceof HttpException ? error.getStatus() : response.statusCode;
    const exceptionResponse =
      error instanceof HttpException ? error.getResponse() : null;
    const errorCode =
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'code' in exceptionResponse &&
      typeof exceptionResponse.code === 'string'
        ? exceptionResponse.code
        : statusCode >= 400
          ? `HTTP_${statusCode}`
          : undefined;
    this.logger.log(
      JSON.stringify({
        requestId: request.requestId,
        userId: request.user?.sub,
        method: request.method,
        route: request.path,
        statusCode,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        errorCode,
      }),
    );
  }
}
