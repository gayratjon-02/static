import {
	ExceptionFilter,
	Catch,
	ArgumentsHost,
	BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Returns structured validation errors instead of generic messages.
 * Frontend can map these to individual form fields.
 */
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
	catch(exception: BadRequestException, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const status = exception.getStatus();
		const exceptionResponse = exception.getResponse() as any;

		// class-validator errors come as array of strings or constraint objects
		if (Array.isArray(exceptionResponse.message)) {
			const fieldErrors: Record<string, string> = {};

			exceptionResponse.message.forEach((msg: any) => {
				if (typeof msg === 'object' && msg.property) {
					// class-validator format with constraints
					const constraints = Object.values(msg.constraints || {});
					fieldErrors[msg.property] = constraints[0] as string;
				} else if (typeof msg === 'string') {
					// Simple string message — try to extract field name
					fieldErrors['_general'] = msg;
				}
			});

			response.status(status).json({
				success: false,
				error: 'Validation failed',
				fieldErrors,
				message: 'Please fix the highlighted fields and try again.',
			});
			return;
		}

		response.status(status).json({
			success: false,
			error: exceptionResponse.error || 'Bad Request',
			message: exceptionResponse.message || 'Invalid request',
		});
	}
}
