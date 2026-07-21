import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ default: 1 })
  @IsInt()
  @Min(1)
  minMember: number;

  @ApiProperty({ default: 1 })
  @IsInt()
  @Min(1)
  maxMember: number;
}
