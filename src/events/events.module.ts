import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventOwnershipService } from './event-ownership.service';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesService } from './categories/categories.service';
import { SchedulesController } from './schedules/schedules.controller';
import { SchedulesService } from './schedules/schedules.service';
import { CommitteeController } from './committee/committee.controller';
import { CommitteeService } from './committee/committee.service';

@Module({
  controllers: [
    EventsController,
    CategoriesController,
    SchedulesController,
    CommitteeController,
  ],
  providers: [
    EventsService,
    EventOwnershipService,
    CategoriesService,
    SchedulesService,
    CommitteeService,
  ],
  exports: [EventOwnershipService],
})
export class EventsModule {}
