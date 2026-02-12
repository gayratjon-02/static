import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	private readonly logger: Logger = new Logger('HTTP');

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const request = context.switchToHttp().getRequest();
		const { method, url, body, authMember } = request;
		const userId = authMember?.id ?? 'anonymous';
		const recordTime = Date.now();

		this.logger.log(`${method} ${url} — user: ${userId} — ${this.stringify(body)}`);

		return next.handle().pipe(
			tap((response) => {
				const responseTime = Date.now() - recordTime;
				this.logger.log(`${method} ${url} — ${responseTime}ms — ${this.stringify(response)}`);
			}),
		);
	}

	private stringify(data: any): string {
		return (JSON.stringify(data) ?? '').slice(0, 100);
	}
}
