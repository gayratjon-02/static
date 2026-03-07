import { IsNotEmpty, IsString, IsBoolean } from 'class-validator';

export class AcceptTosDto {
    @IsBoolean()
    @IsNotEmpty()
    tos_accepted: boolean;

    @IsString()
    @IsNotEmpty()
    tos_version: string;
}
