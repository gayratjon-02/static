import { IsEnum, IsNotEmpty } from 'class-validator';
import { AdminRole } from '../../enums/common.enum';

export class GenerateInviteDto {
    @IsEnum(AdminRole)
    @IsNotEmpty()
    role: AdminRole;
}
