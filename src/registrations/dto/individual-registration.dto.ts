import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class IndividualRegistrationDto {
  @ApiProperty({ description: 'Category.id — harus maxMember === 1' })
  @IsUUID()
  categoryId: string;
}
