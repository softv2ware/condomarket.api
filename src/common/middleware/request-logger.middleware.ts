import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip, correlationId } = req;
    const userAgent = req.get('user-agent') || '';
    const startTime = Date.now();

    // Log request
    this.logger.log({
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
        this.logger.error(logData);
      } else if (statusCode >= 400) {
        this.logger.warn(logData);
      } else {
        this.logger.log(logData);
      }
    });

    next();
  }
}
