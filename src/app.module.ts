import { PrismaModule } from './prisma/prisma.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './common/config/app-config.module';
import { HashingModule } from './common/hashing/hashing.module';
import { UploadModule } from './upload/upload.module';
import { authEnvSchema } from './common/config/auth-env.schema';

@Module({
  imports: [AppConfigModule.forProject(authEnvSchema), HashingModule, PrismaModule, UploadModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
