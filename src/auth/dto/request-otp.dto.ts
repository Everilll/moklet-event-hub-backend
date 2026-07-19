import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: 'siswa@smktelkom-mlg.sch.id' })
  @IsEmail()
  email: string;
}
