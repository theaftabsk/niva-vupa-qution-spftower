import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { QuestionsModule } from './questions/questions.module';
import { CandidatesModule } from './candidates/candidates.module';
import { ProctoringModule } from './proctoring/proctoring.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { HeadstartIntegrationModule } from './integration/headstart/headstart-integration.module';
import { VendorApiModule } from './integration/vendor-api/vendor-api.module';
import { EmailModule } from './email/email.module';
import { CreditsModule } from './credits/credits.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { VendorsModule } from './vendors/vendors.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    PrismaModule,
    AuthModule,
    VendorsModule,
    QuestionsModule,
    CandidatesModule,
    ProctoringModule,
    AssessmentsModule,
    HeadstartIntegrationModule,
    VendorApiModule,
    EmailModule,
    CreditsModule,
    SuperAdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
