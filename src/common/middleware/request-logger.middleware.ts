import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    console.log(
      `RequestLoggerMiddleware: Logger has ${this.logger.transports?.length || 0} transports`,
    );
  }

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip, correlationId } = req;
    const userAgent = req.get('user-agent') || '';
    const startTime = Date.now();

    // Log request
    this.logger.info('Incoming request', {
      type: 'request',
      method,
      url: originalUrl,
      correlationId,
      ip,
      userAgent,
    });

    // Log response
    res.on('finish', () => {
      const { statusCode } = res;
      const responseTime = Date.now() - startTime;

      const logData = {
        type: 'response',
        method,
        url: originalUrl,
        correlationId,
        statusCode,
        responseTime: `${responseTime}ms`,
        ip,
      };

      if (statusCode >= 500) {
        this.logger.error('Request failed', logData);
      } else if (statusCode >= 400) {
        this.logger.warn('Request warning', logData);
      } else {
        this.logger.info('Request completed', logData);
      }
    });

    next();
  }
}
