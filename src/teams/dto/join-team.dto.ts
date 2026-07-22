import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class JoinTeamDto {
  @ApiProperty({ example: '482913' })
  @IsString()
  @Length(6, 6)
  code: string;
}
