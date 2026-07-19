import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class CreatePanitiaDto {
  @ApiProperty({ example: 'kakak.osis@gmail.com', description: 'Boleh domain email apa saja — cukup email yang aktif dipakai panitia tsb.' })
  @IsEmail()
  email: string;
}
