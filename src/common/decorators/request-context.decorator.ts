import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestContextData {
  requestId?: string;
  ip?: string;
}

export const RequestContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestContextData => {
    const request = context
      .switchToHttp()
      .getRequest<{ requestId?: string; ip?: string }>();
    return { requestId: request.requestId, ip: request.ip };
  },
);
