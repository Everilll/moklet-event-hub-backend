import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, ValidateNested } from 'class-validator';
import { CreateClassDto } from './create-class.dto';

export class BulkCreateClassDto {
  @ApiProperty({ type: [CreateClassDto] })
  @ValidateNested({ each: true })
  @Type(() => CreateClassDto)
  @ArrayMinSize(1)
  classes: CreateClassDto[];
}
