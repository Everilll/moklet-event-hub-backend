import { BadRequestException } from '@nestjs/common';

export function assertStudentDomain(email: string, allowedHd: string): void {
  const domain = email.split('@')[1];
  if (domain !== allowedHd) {
    throw new BadRequestException(
      `Hanya email institusi siswa (@${allowedHd}) yang bisa mendaftar sendiri. ` +
        `Akun panitia dibuatkan oleh Admin Kesiswaan.`,
    );
  }
}
