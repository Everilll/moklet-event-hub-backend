import { PrismaModule } from './prisma/prisma.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './common/config/app-config.module';
import { HashingModule } from './common/hashing/hashing.module';
import { UploadModule } from './upload/upload.module';
import { authEnvSchema } from './common/config/auth-env.schema';
import { AuthModule } from './auth/auth.module';
import { StudentsModule } from './students/students.module';
import { ClassesModule } from './classes/classes.module';
import { EventsModule } from './events/events.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { ExportModule } from './export/export.module';
import { TeamsModule } from './teams/teams.module';
import { RegistrationsModule } from './registrations/registrations.module';

@Module({
  imports: [AppConfigModule.forProject(authEnvSchema), HashingModule, PrismaModule, UploadModule, AuthModule, StudentsModule, ClassesModule, EventsModule, AnnouncementsModule, ExportModule, TeamsModule, RegistrationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
