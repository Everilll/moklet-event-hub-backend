import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: 'siswa@student.smktelkom-mlg.sch.id' })
  @IsEmail()
  email: string;
}
