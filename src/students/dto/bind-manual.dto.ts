import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class BindManualDto {
  @ApiProperty({ description: 'Account.id siswa yang mau di-bind manual oleh admin' })
  @IsUUID()
  accountId: string;
}
