import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, MinLength } from 'class-validator';

export class CreateScheduleDto {
  @ApiProperty({ example: '2026-08-17' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'Hari ke-1' })
  @IsString()
  @MinLength(1)
  dayLabel: string;

  @ApiProperty({ example: 'Batik bebas rapi' })
  @IsString()
  @MinLength(1)
  dresscodeText: string;
}
