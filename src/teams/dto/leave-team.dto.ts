import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class LeaveTeamDto {
  @ApiProperty({
    required: false,
    description:
      'WAJIB diisi kalau yang leave adalah leader dan tim masih punya anggota lain — pilih Student.id anggota yang jadi leader baru.',
  })
  @IsOptional()
  @IsUUID()
  newLeaderStudentId?: string;
}
