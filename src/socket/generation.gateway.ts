import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
	cors: {
		origin: [
			process.env.FRONTEND_URL || 'http://localhost:3000',
			'http://localhost:3000',
			'http://localhost:4010',
		],
		credentials: true,
	},
})
export class GenerationGateway {
	private readonly logger = new Logger('GenerationGateway');

	@WebSocketServer()
	server: Server;

	/** Generation progress update */
	emitProgress(userId: string, data: { job_id: string; step: string; message: string; progress_percent: number }) {
		this.logger.log(`Progress [${data.job_id}]: ${data.step} — ${data.progress_percent}%`);
		this.server.emit(`generation:progress:${userId}`, data);
	}

	/** Generation completed */
	emitCompleted(userId: string, data: { job_id: string; ad_id: string; image_url: string }) {
		this.logger.log(`Completed [${data.job_id}]: ad ${data.ad_id}`);
		this.server.emit(`generation:completed:${userId}`, data);
	}

	/** Generation failed */
	emitFailed(userId: string, data: { job_id: string; error: string }) {
		this.logger.error(`Failed [${data.job_id}]: ${data.error}`);
		this.server.emit(`generation:failed:${userId}`, data);
	}
}
