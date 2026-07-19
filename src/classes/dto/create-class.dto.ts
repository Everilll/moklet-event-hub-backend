import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';

export class CreateClassDto {
  @ApiProperty({ enum: ['X', 'XI', 'XII'] })
  @IsIn(['X', 'XI', 'XII'])
  grade: 'X' | 'XI' | 'XII';

  @ApiProperty({ example: 'RPL 1' })
  @IsString()
  @MinLength(1)
  name: string;
}
