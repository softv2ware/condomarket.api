import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');
  private readonly slowThreshold = 1000; // 1 second

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, correlationId } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        
        if (duration > this.slowThreshold) {
          this.logger.warn({
            message: 'Slow request detected',
            method,
            url,
            correlationId,
            duration: `${duration}ms`,
            threshold: `${this.slowThreshold}ms`,
          });
        } else {
          this.logger.debug({
            message: 'Request completed',
            method,
            url,
            correlationId,
            duration: `${duration}ms`,
          });
        }
      }),
    );
  }
}
