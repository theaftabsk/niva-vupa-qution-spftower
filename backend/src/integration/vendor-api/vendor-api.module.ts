import { Module } from '@nestjs/common';
import { VendorApiController } from './vendor-api.controller';
import { VendorApiService } from './vendor-api.service';
import { VendorApiGuard } from './vendor-api.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [VendorApiController],
  providers: [VendorApiService, VendorApiGuard],
  exports: [VendorApiService],
})
export class VendorApiModule {}
