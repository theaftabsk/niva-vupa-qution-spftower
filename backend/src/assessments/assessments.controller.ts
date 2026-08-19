import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { AssessmentsService } from './assessments.service';

@Controller('api/v1/assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Get()
  async getAssessments(
    @Query('vendorId') vendorId?: string,
    @Headers('x-user-role') headerRole?: string,
    @Headers('x-vendor-id') headerVendorId?: string,
  ) {
    const effectiveVendorId = vendorId || headerVendorId;
    const data = await this.assessmentsService.getAssessments(effectiveVendorId);
    return { success: true, assessments: data };
  }

  @Get(':id')
  async getAssessmentById(@Param('id') id: string) {
    const data = await this.assessmentsService.getAssessmentById(id);
    return { success: true, assessment: data };
  }

  @Post('save')
  async saveAssessment(
    @Body()
    body: {
      id?: string;
      name: string;
      slug?: string;
      description?: string;
      durationMins?: number;
      activeFrom?: string;
      activeUntil?: string;
      passingPercentage?: number;
      maxProctorWarnings?: number;
      status?: string;
      assignedVendorIds?: string[];
    },
    @Headers('x-user-role') role?: string,
  ) {
    if (role === 'VENDOR') {
      throw new ForbiddenException("You don't have permission to create or modify assessments. Only Admin can manage assessments.");
    }
    const assessment = await this.assessmentsService.saveAssessment(body, role);
    return { success: true, assessment };
  }

  @Post()
  async createAssessment(
    @Body()
    body: {
      id?: string;
      name: string;
      slug?: string;
      description?: string;
      durationMins?: number;
      activeFrom?: string;
      activeUntil?: string;
      passingPercentage?: number;
      maxProctorWarnings?: number;
      status?: string;
      assignedVendorIds?: string[];
    },
    @Headers('x-user-role') role?: string,
  ) {
    if (role === 'VENDOR') {
      throw new ForbiddenException("You don't have permission to create or modify assessments. Only Admin can manage assessments.");
    }
    const assessment = await this.assessmentsService.saveAssessment(body, role);
    return { success: true, assessment };
  }

  @Put(':id')
  async updateAssessment(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      durationMins?: number;
      activeFrom?: string;
      activeUntil?: string;
      passingPercentage?: number;
      maxProctorWarnings?: number;
      status?: string;
      assignedVendorIds?: string[];
    },
    @Headers('x-user-role') role?: string,
  ) {
    if (role === 'VENDOR') {
      throw new ForbiddenException("You don't have permission to modify assessments. Only Admin can manage assessments.");
    }
    const assessment = await this.assessmentsService.saveAssessment({ id, ...body, name: body.name || 'Assessment' }, role);
    return { success: true, assessment };
  }

  @Delete(':id')
  async deleteAssessment(
    @Param('id') id: string,
    @Headers('x-user-role') role?: string,
  ) {
    if (role === 'VENDOR') {
      throw new ForbiddenException("You don't have permission to delete assessments. Only Admin can manage assessments.");
    }
    await this.assessmentsService.deleteAssessment(id, role);
    return { success: true, message: 'Assessment archived/deleted' };
  }
}
