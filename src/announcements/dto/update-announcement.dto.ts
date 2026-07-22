import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateAnnouncementDto } from './create-announcement.dto';

// eventId tidak bisa diubah setelah dibuat — pengumuman tetap global atau tetap event-scoped
export class UpdateAnnouncementDto extends PartialType(
  OmitType(CreateAnnouncementDto, ['eventId'] as const),
) {}
