import { Body, Controller, Get, Post } from '@nestjs/common';
import { MemberService } from './member.service';
import { SignupDto } from '../../libs/dto/member/signup.dto';
import { AuthResponse } from '../../libs/types/member/member.type';
import { LoginDto } from 'src/libs/dto/member/login.dto';

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
        return this.memberService.signup(input);
    }

    // login API 
    @Post('login') 
    public async login(@Body() input: LoginDto): Promise<AuthResponse> {
        console.log("Login input:", input)
        return this.memberService.login(input)

    }
}
