import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('api/v1/vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  async create(
    @Body()
    body: {
      name: string;
      email: string;
      password?: string;
      phone?: string;
      contactPerson?: string;
      assignedAssessmentIds?: string[];
    },
  ) {
    return this.vendorsService.create(body);
  }

  @Get()
  async findAll() {
    return this.vendorsService.findAll();
  }

  @Get('api-logs/all')
  async getAllVendorApiLogs(
    @Query('vendorId') vendorId?: string,
    @Query('apiType') apiType?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.vendorsService.getAllVendorApiLogs({
      vendorId,
      apiType,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('activity-logs/all')
  async getAllVendorActivityLogs(
    @Query('vendorId') vendorId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.vendorsService.getAllVendorActivityLogs({
      vendorId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id/dashboard-details')
  async getVendorDashboardDetails(@Param('id') id: string) {
    return this.vendorsService.getVendorDashboardDetails(id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.vendorsService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      phone?: string;
      contactPerson?: string;
      status?: string;
      password?: string;
      assignedAssessmentIds?: string[];
    },
  ) {
    return this.vendorsService.update(id, body);
  }

  @Post(':id/assign-assessments')
  async assignAssessments(
    @Param('id') id: string,
    @Body() body: { assessmentIds: string[]; assignedBy?: string },
  ) {
    return this.vendorsService.assignAssessments(id, body.assessmentIds, body.assignedBy || 'Admin');
  }

  @Post('reassign-candidates')
  async reassignCandidates(
    @Body() body: { candidateIds: string[]; toVendorId: string | null },
  ) {
    return this.vendorsService.reassignCandidates(body.candidateIds, body.toVendorId);
  }

  @Post(':id/regenerate-api-key')
  async regenerateApiKey(@Param('id') id: string) {
    return this.vendorsService.regenerateApiKey(id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.vendorsService.delete(id);
  }
}
