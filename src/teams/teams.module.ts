import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule], // butuh EventOwnershipService untuk disqualify
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
