import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateEventStatusDto {
  @ApiProperty({ enum: ['ONGOING', 'CLOSED'] })
  @IsIn(['ONGOING', 'CLOSED'])
  status: 'ONGOING' | 'CLOSED';
}
