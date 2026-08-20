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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiBody,
  ApiQuery,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { VendorApiService } from './vendor-api.service';
import { VendorApiGuard } from './vendor-api.guard';

// ─── DTOs for Swagger Documentation ──────────────────────────────────────────

export class CreateAssessmentDto {
  @ApiProperty({
    example: 'Banca Relationship Manager Assessment',
    description: 'Name of the assessment session',
  })
  name: string;

  @ApiPropertyOptional({
    example: 'banca-rm-assessment-2026',
    description: 'Custom URL slug (auto-generated if omitted)',
  })
  slug?: string;

  @ApiPropertyOptional({
    example: 'VND-ASSESS-101',
    description: 'Your internal external assessment reference ID',
  })
  vendorAssessmentId?: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'Max proctor warning count before disqualification',
    default: 3,
  })
  maxProctorWarnings?: number;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
  })
  status?: string;
}

export class CandidateItemDto {
  @ApiProperty({ example: 'Aftab Sk', description: 'Full name of candidate' })
  name: string;

  @ApiProperty({ example: 'aftab@example.com', description: 'Email address of candidate' })
  email: string;

  @ApiProperty({ example: '9876543210', description: 'Mobile phone number' })
  phone: string;

  @ApiProperty({
    example: 'APP-2026-001',
    description: 'Candidate Application ID / Unique Reference ID',
  })
  applicationId: string;

  @ApiPropertyOptional({
    example: 'VND-CAND-01',
    description: 'Optional external vendor-specific candidate ID',
  })
  vendorCandidateId?: string;
}

export class AddCandidatesDto {
  @ApiProperty({
    example: 'banca-rm-assessment-2026',
    description: 'Assessment ID or Slug to assign candidate(s) to',
  })
  assessmentId: string;

  @ApiProperty({
    type: [CandidateItemDto],
    description: 'List of candidates to add and generate unique exam links for',
  })
  candidates: CandidateItemDto[];
}

// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Vendor Integration APIs')
@ApiSecurity('x-api-key')
@Controller('api/v1/vendor-api')
@UseGuards(VendorApiGuard)
export class VendorApiController {
  constructor(private readonly vendorApiService: VendorApiService) {}

  /**
   * 1️⃣ Incoming API 1: Assessment Create / Sync API
   */
  @Post('assessments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '1. Create or Sync Assessment',
    description:
      'Creates or updates an assessment mapped specifically to the authenticated Vendor account. Fixed duration is 45 mins with 60 questions.',
  })
  @ApiBody({ type: CreateAssessmentDto })
  @ApiResponse({
    status: 200,
    description: 'Assessment successfully created or synced.',
    schema: {
      example: {
        success: true,
        message: 'Assessment created/synced successfully.',
        data: {
          assessmentId: '7efb22b7-ac55-4dbc-9950-64558257d065',
          vendorAssessmentId: 'VND-ASSESS-101',
          name: 'Banca Relationship Manager Assessment',
          slug: 'banca-rm-assessment-2026',
          assessmentLink: 'https://niva.greatcampus.in/banca-rm-assessment-2026',
          durationMins: 45,
          totalQuestions: 60,
          status: 'ACTIVE',
          createdAt: '2026-08-21T02:35:05.199Z',
        },
      },
    },
  })
  async createOrSyncAssessment(@Req() req: any, @Body() body: CreateAssessmentDto) {
    return this.vendorApiService.createOrSyncAssessment(req.vendor, body);
  }

  /**
   * 2️⃣ Incoming API 2: Candidate Add / Assign API (Unique Link Generation)
   */
  @Post('candidates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '2. Add Candidates & Generate Unique Secure Exam Links',
    description:
      'Enrolls candidates under the vendor account and returns individual, non-shareable Unique Secure Token URLs for each candidate.',
  })
  @ApiBody({ type: AddCandidatesDto })
  @ApiResponse({
    status: 200,
    description: 'Candidates enrolled and unique exam links generated.',
    schema: {
      example: {
        success: true,
        count: 1,
        assessmentId: '7efb22b7-ac55-4dbc-9950-64558257d065',
        assessmentName: 'Banca Relationship Manager Assessment',
        data: [
          {
            candidateId: 'c3f74389-7ee3-4ca2-ac3b-7af0d74037f2',
            name: 'Aftab Sk',
            email: 'aftab@example.com',
            phone: '9876543210',
            applicationId: 'APP-2026-001',
            vendorCandidateId: 'VND-CAND-01',
            secureToken: 'sec_b5223bdad4e70ba72e76934ad4c24461',
            examUrl: 'https://niva.greatcampus.in/banca-rm-assessment-2026?token=sec_b5223bdad4e70ba72e76934ad4c24461',
            status: 'NOT_STARTED',
          },
        ],
      },
    },
  })
  async addOrAssignCandidates(@Req() req: any, @Body() body: AddCandidatesDto) {
    return this.vendorApiService.addOrAssignCandidates(req.vendor, body);
  }

  /**
   * 3️⃣ Outgoing / Vendor API 3: Active Assessments API
   */
  @Get('assessments/active')
  @ApiOperation({
    summary: '3. List Active Assessments',
    description: 'Retrieves all active assessments assigned to this authenticated vendor account.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of active assessments for the vendor.',
    schema: {
      example: {
        success: true,
        count: 1,
        data: [
          {
            assessmentId: '9358c401-645f-4ff7-b441-c59d032352ef',
            assessmentName: 'Niva Bupa Udaan Assessment - Masai',
            assessmentSlug: 'niva-bupa-udaan-assessment-masai-9692',
            assessmentLink: 'https://niva.greatcampus.in/niva-bupa-udaan-assessment-masai-9692',
            durationMins: 45,
            totalQuestions: 60,
            status: 'ACTIVE',
          },
        ],
      },
    },
  })
  async getActiveAssessments(@Req() req: any) {
    return this.vendorApiService.getActiveAssessments(req.vendor);
  }

  /**
   * 4️⃣ Outgoing / Vendor API 4: Candidate Status / Result API
   */
  @Get('candidates/status')
  @ApiOperation({
    summary: '4. Get Candidate Exam Status & Score',
    description:
      'Queries live exam progress, completion status, warning count, and obtained score for candidates registered by this vendor.',
  })
  @ApiQuery({ name: 'applicationId', required: false, description: 'Candidate Application ID (e.g. APP-2026-001)' })
  @ApiQuery({ name: 'candidateId', required: false, description: 'Internal Candidate UUID' })
  @ApiQuery({ name: 'vendorCandidateId', required: false, description: 'External Vendor Candidate ID' })
  @ApiQuery({ name: 'assessmentId', required: false, description: 'Filter candidates by Assessment ID or Slug' })
  @ApiQuery({ name: 'email', required: false, description: 'Candidate Email' })
  @ApiResponse({
    status: 200,
    description: 'Candidate exam status, start/submit times, and scorecard details.',
    schema: {
      example: {
        success: true,
        count: 1,
        data: [
          {
            candidateId: 'c3f74389-7ee3-4ca2-ac3b-7af0d74037f2',
            applicationId: 'APP-2026-001',
            vendorCandidateId: 'VND-CAND-01',
            name: 'Aftab Sk',
            email: 'aftab@example.com',
            phone: '9876543210',
            assessmentId: '7efb22b7-ac55-4dbc-9950-64558257d065',
            assessmentName: 'Banca Relationship Manager Assessment',
            assessmentSlug: 'banca-rm-assessment-2026',
            status: 'COMPLETED',
            examStartedAt: '2026-08-21T11:00:00.000Z',
            examSubmittedAt: '2026-08-21T11:38:15.000Z',
            totalTimeSpent: '38 mins 15 secs',
            totalMarks: 60,
            obtainedMarks: 52,
            percentage: 87,
            warningCount: 0,
          },
        ],
      },
    },
  })
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
