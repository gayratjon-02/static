import { Injectable } from '@nestjs/common';

@Injectable()
export class MemberService {
	constructor() {}

	public async testMethod() {
		return { message: 'Member service is working!' };
	}
}
