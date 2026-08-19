import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
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

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.vendorsService.delete(id);
  }
}
