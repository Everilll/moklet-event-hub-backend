import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { paginate } from '../common/helpers/paginate.helper';

export interface BulkCreateResult {
  successCount: number;
  skippedCount: number;
  skipped: { grade: string; name: string; reason: string }[];
}

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClassDto) {
    return this.prisma.class.create({ data: dto });
  }

  async bulkCreate(classes: CreateClassDto[]): Promise<BulkCreateResult> {
    let successCount = 0;
    const skipped: BulkCreateResult['skipped'] = [];

    for (const dto of classes) {
      const existing = await this.prisma.class.findUnique({
        where: { grade_name: { grade: dto.grade, name: dto.name } },
      });
      if (existing) {
        skipped.push({ grade: dto.grade, name: dto.name, reason: 'Sudah ada' });
        continue;
      }
      await this.prisma.class.create({ data: dto });
      successCount++;
    }

    return { successCount, skippedCount: skipped.length, skipped };
  }

  async findAll(pagination: PaginationDto) {
    const { skip, limit = 20, page = 1 } = pagination;
    const [data, total] = await Promise.all([
      this.prisma.class.findMany({
        skip,
        take: limit,
        orderBy: [{ grade: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.class.count(),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const kelas = await this.prisma.class.findUnique({ where: { id } });
    if (!kelas) throw new NotFoundException('Kelas tidak ditemukan');
    return kelas;
  }

  async update(id: string, dto: UpdateClassDto) {
    await this.findOne(id);
    return this.prisma.class.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.class.delete({ where: { id } });
  }
}
