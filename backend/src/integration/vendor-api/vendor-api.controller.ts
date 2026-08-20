import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { VendorApiService } from './vendor-api.service';
import { VendorApiGuard } from './vendor-api.guard';

@Controller('api/v1/vendor-api')
@UseGuards(VendorApiGuard)
export class VendorApiController {
  constructor(private readonly vendorApiService: VendorApiService) {}

  /**
   * 1️⃣ Incoming API 1: Assessment Create / Sync API
   * Used by Vendor / Agency to create or sync an assessment under their tenant.
   */
  @Post('assessments')
  @HttpCode(HttpStatus.OK)
  async createOrSyncAssessment(@Req() req: any, @Body() body: any) {
    return this.vendorApiService.createOrSyncAssessment(req.vendor, body);
  }

  /**
   * 2️⃣ Incoming API 2: Candidate Add / Assign API
   * Used by Vendor / Agency to add candidates and receive Unique Exam Links.
   */
  @Post('candidates')
  @HttpCode(HttpStatus.OK)
  async addOrAssignCandidates(@Req() req: any, @Body() body: any) {
    return this.vendorApiService.addOrAssignCandidates(req.vendor, body);
  }

  /**
   * 3️⃣ Outgoing / Vendor API 3: Active Assessments API
   * Used by Vendor / Agency to get list of active assessments for their account.
   */
  @Get('assessments/active')
  async getActiveAssessments(@Req() req: any) {
    return this.vendorApiService.getActiveAssessments(req.vendor);
  }

  /**
   * 4️⃣ Outgoing / Vendor API 4: Candidate Status / Result API
   * Used by Vendor / Agency to query candidate exam progress, status & marks.
   */
  @Get('candidates/status')
  async getCandidateStatus(
    @Req() req: any,
    @Query('applicationId') applicationId?: string,
    @Query('candidateId') candidateId?: string,
    @Query('vendorCandidateId') vendorCandidateId?: string,
    @Query('assessmentId') assessmentId?: string,
    @Query('email') email?: string,
  ) {
    return this.vendorApiService.getCandidateStatus(req.vendor, {
      applicationId,
      candidateId,
      vendorCandidateId,
      assessmentId,
      email,
    });
  }
}
