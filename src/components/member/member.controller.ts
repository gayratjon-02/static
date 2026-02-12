import { Controller, Get, Post } from '@nestjs/common';
import { MemberService } from './member.service';

@Controller('member')
export class MemberController {
    constructor(private readonly memberService: MemberService) {}

    @Get('test')
    public testEndpoint() {
        return this.memberService.testMethod();
    }
}
