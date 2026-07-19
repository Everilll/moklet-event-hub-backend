import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSystemSettingDto } from './dto/update-system-setting.dto';

@Injectable()
export class SystemSettingService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const setting = await this.prisma.systemSetting.findFirst();
    if (!setting) {
      throw new NotFoundException(
        'SystemSetting belum ada — pastikan sudah di-seed (lihat prisma/seed.ts)',
      );
    }
    return setting;
  }

  async update(dto: UpdateSystemSettingDto) {
    const setting = await this.get();
    return this.prisma.systemSetting.update({
      where: { id: setting.id },
      data: dto,
    });
  }
}
