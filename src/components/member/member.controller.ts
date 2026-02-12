import { Body, Controller, Get, Post } from '@nestjs/common';
import { MemberService } from './member.service';
import { SignupDto } from '../../libs/dto/member/signup.dto';
import { AuthResponse } from '../../libs/types/member/member.type';

@Controller('member')
export class MemberController {
    constructor(private readonly memberService: MemberService) {}

    // test API
    @Get('test')
    public testEndpoint() {
        return this.memberService.testMethod();
    }

    // sign up API
    @Post('signup')
    public async signup(@Body() input: SignupDto): Promise<AuthResponse> {
        console.log('Signup input:', input);
        return this.memberService.signup(input);
    }
}
