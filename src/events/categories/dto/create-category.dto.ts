import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { TeamCompositionMode } from 'generated/prisma/client';

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

  @ApiProperty({
    enum: TeamCompositionMode,
    default: TeamCompositionMode.FREE,
    description: 'Mode komposisi tim untuk cabang lomba ini',
  })
  @IsEnum(TeamCompositionMode)
  teamCompositionMode: TeamCompositionMode;

  @ApiPropertyOptional({
    description: 'Maksimal tim per grup (kelas/angkatan). Wajib diisi jika mode BUKAN FREE.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxTeamsPerGroup?: number;
}
