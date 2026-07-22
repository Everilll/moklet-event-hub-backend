import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventOwnershipService } from '../event-ownership.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: EventOwnershipService,
  ) {}

  private assertMinMax(minMember: number, maxMember: number) {
    if (minMember > maxMember) {
      throw new BadRequestException('minMember tidak boleh lebih besar dari maxMember');
    }
  }

  async create(eventId: string, accountId: string, dto: CreateCategoryDto) {
    await this.ownership.assertCanManage(eventId, accountId);
    this.assertMinMax(dto.minMember, dto.maxMember);
    return this.prisma.category.create({ data: { ...dto, eventId } });
  }

  async findAllByEvent(eventId: string) {
    return this.prisma.category.findMany({ where: { eventId } });
  }

  private async findOneOrThrow(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Kategori/cabang lomba tidak ditemukan');
    return category;
  }

  async update(id: string, accountId: string, dto: UpdateCategoryDto) {
    const category = await this.findOneOrThrow(id);
    await this.ownership.assertCanManage(category.eventId, accountId);

    const minMember = dto.minMember ?? category.minMember;
    const maxMember = dto.maxMember ?? category.maxMember;
    this.assertMinMax(minMember, maxMember);

    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string, accountId: string) {
    const category = await this.findOneOrThrow(id);
    await this.ownership.assertCanManage(category.eventId, accountId);
    // onDelete: Restrict in Registration.categoryId & Team.categoryId
    await this.prisma.category.delete({ where: { id } });
  }
}
