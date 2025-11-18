import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface AuthenticatedSocket {
  userId?: string;
}

export const WsUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const client = ctx.switchToWs().getClient<AuthenticatedSocket>();
    return client.userId || '';
  },
);
