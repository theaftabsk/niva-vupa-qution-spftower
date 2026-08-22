import { Controller, Get, Post, Delete, Body, Query, Param, Res, Headers } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import type { Response } from 'express';

@Controller('api/v1/candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  // --- DEDICATED ASSESSMENT DASHBOARD ---
  @Get('assessment-dashboard/:id')
  async getAssessmentDashboard(
    @Param('id') id: string,
    @Query('vendorId') vendorId?: string,
    @Headers('x-vendor-id') headerVendorId?: string,
  ) {
    const effectiveVendorId = vendorId || headerVendorId;
    return this.candidatesService.getAssessmentDashboard(id, effectiveVendorId);
  }

  @Post(':id/assign-vendor')
  async assignCandidateVendor(
    @Param('id') candidateId: string,
    @Body() body: { vendorId: string | null },
  ) {
    return this.candidatesService.assignCandidateVendor(candidateId, body.vendorId);
  }

  @Post('bulk-assign-vendor')
  async bulkAssignCandidateVendor(
    @Body() body: { candidateIds: string[]; vendorId: string | null },
  ) {
    return this.candidatesService.bulkAssignCandidateVendor(body.candidateIds, body.vendorId);
  }

  @Post('upload-excel')
  async uploadCandidatesExcel(
    @Body()
    body: {
      assessmentId: string;
      candidates: Array<{ name: string; email: string; phone?: string; applicationId?: string; vendorId?: string }>;
      vendorId?: string;
    },
    @Headers('x-vendor-id') headerVendorId?: string,
  ) {
    const effectiveVendorId = body.vendorId || headerVendorId;
    return this.candidatesService.uploadCandidatesExcel({ ...body, vendorId: effectiveVendorId });
  }

  @Post('verify-token')
  async verifyCandidateToken(@Body() body: { token: string; email?: string }) {
    return this.candidatesService.verifyCandidateToken(body.token, body.email);
  }

  @Get('export-comprehensive')
  async exportAllComprehensiveExcel(@Res() res: Response) {
    const buffer = await this.candidatesService.exportComprehensiveExcel();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Niva_Bupa_Assessment_Report_${Date.now()}.xlsx"`);
    res.send(buffer);
  }

  @Get('export-comprehensive/:assessmentId')
  async exportComprehensiveExcel(
    @Param('assessmentId') assessmentId: string,
    @Res() res: Response
  ) {
    const buffer = await this.candidatesService.exportComprehensiveExcel(assessmentId === 'all' ? undefined : assessmentId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Niva_Bupa_Assessment_Report_${Date.now()}.xlsx"`);
    res.send(buffer);
  }

  // --- ASSESSMENT SESSION ROUTES (MUST COME BEFORE :id DYNAMIC ROUTES) ---
  @Get('assessments/list')
  async getAllAssessments() {
    const assessments = await this.candidatesService.getAllAssessments();
    return { success: true, assessments };
  }

  @Get('assessments/details/:identifier')
  async getAssessmentByIdentifier(@Param('identifier') identifier: string) {
    const assessment = await this.candidatesService.getAssessmentByIdentifier(identifier);
    return { success: true, assessment };
  }

  @Post('assessments/save')
  async createOrUpdateAssessment(
    @Body()
    body: {
      id?: string;
      name: string;
      slug?: string;
      description?: string;
      durationMins?: number;
      activeFrom?: string;
      activeUntil?: string;
      activeHours?: number;
      passingPercentage?: number;
      maxProctorWarnings?: number;
      status?: string;
    }
  ) {
    const assessment = await this.candidatesService.createOrUpdateAssessment(body);
    return { success: true, assessment };
  }

  @Delete('assessments/:id')
  async deleteAssessment(@Param('id') id: string) {
    await this.candidatesService.deleteAssessment(id);
    return { success: true, message: 'Assessment deleted successfully' };
  }

  // --- CANDIDATE ROUTES ---
  @Get()
  async getCandidates(
    @Query('assessmentId') assessmentId?: string,
    @Query('vendorId') vendorId?: string,
    @Headers('x-vendor-id') headerVendorId?: string,
  ) {
    const effectiveVendorId = vendorId || headerVendorId;
    const candidates = await this.candidatesService.getCandidates(assessmentId, effectiveVendorId);
    return { success: true, candidates };
  }

  @Post('register')
  async registerCandidate(
    @Body()
    body: {
      name: string;
      email: string;
      phone: string;
      assessmentId: string;
      referenceId?: string;
      applicationId?: string;
      vendorId?: string;
    },
    @Headers('x-vendor-id') headerVendorId?: string,
  ) {
    const effectiveVendorId = body.vendorId || headerVendorId;
    const candidate = await this.candidatesService.registerCandidate({ ...body, vendorId: effectiveVendorId });
    return { success: true, candidate };
  }

  @Post('verify-and-start')
  async verifyAndStartExam(
    @Body()
    body: {
      applicationId: string;
      assessmentId: string;
      name?: string;
      email?: string;
      phone?: string;
    }
  ) {
    const data = await this.candidatesService.verifyAndStartExam(body);
    return { success: true, ...data };
  }

  @Post('start-exam')
  async startExamSession(@Body() body: { candidateIdentifier: string }) {
    const data = await this.candidatesService.startExamSession(body.candidateIdentifier);
    return { success: true, ...data };
  }

  @Post('save-answer')
  async saveAnswer(
    @Body()
    body: {
      attemptId: string;
      questionId: string;
      selectedOption: string | null;
      timeTakenSec?: number;
    }
  ) {
    return this.candidatesService.saveAnswer(body);
  }

  @Get('status/:attemptId')
  async checkAttemptStatus(@Param('attemptId') attemptId: string) {
    return this.candidatesService.checkAttemptStatus(attemptId);
  }

  @Post('submit-exam')
  async submitExam(
    @Body()
    body: {
      attemptId: string;
      answers: Record<string, { selectedOption: string | null; timeTakenSec: number }>;
    }
  ) {
    const attempt = await this.candidatesService.submitExam(body.attemptId, body.answers);
    return { success: true, attempt };
  }

  @Post('log-proctoring')
  async logProctoringEvent(
    @Body()
    body: {
      attemptId: string;
      eventType: string;
      details?: string;
    }
  ) {
    const result = await this.candidatesService.logProctoringEvent(body.attemptId, body.eventType, body.details);
    return { success: true, ...result };
  }

  @Post(':id/unlock')
  async unlockCandidate(
    @Param('id') id: string,
    @Body() body: { adminId?: string; adminName?: string; reason?: string }
  ) {
    const result = await this.candidatesService.unlockCandidate(
      id,
      body.adminId || 'admin',
      body.adminName || 'HR Administrator',
      body.reason,
    );
    return result;
  }

  @Get(':id/report')
  async getCandidateReport(@Param('id') id: string) {
    return this.candidatesService.getCandidateReport(id);
  }

  @Get(':id/export-excel')
  async exportSingleCandidateExcel(
    @Param('id') id: string,
    @Res() res: Response
  ) {
    const { buffer, candidateName, applicationId } = await this.candidatesService.exportSingleCandidateExcel(id);
    const safeName = candidateName.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Scorecard_${safeName}_${applicationId}.xlsx"`);
    res.send(buffer);
  }

  @Post(':id/remarks')
  async saveCandidateRemarks(
    @Param('id') id: string,
    @Body() body: { adminId?: string; remark: string }
  ) {
    return this.candidatesService.saveCandidateRemarks(id, body.adminId || 'admin', body.remark);
  }

  @Get('audit-logs/resets')
  async getCandidateResetAuditLogs(
    @Query('vendorId') vendorId?: string,
    @Query('candidateSearch') candidateSearch?: string,
    @Query('performedByRole') performedByRole?: string,
    @Query('reasonCode') reasonCode?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.candidatesService.getCandidateResetAuditLogs({
      vendorId,
      candidateSearch,
      performedByRole,
      reasonCode,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
    });
  }

  @Get(':id/timeline')
  async getCandidateTimeline(@Param('id') id: string) {
    return this.candidatesService.getCandidateTimelineHistory(id);
  }

  @Post(':id/reset')
  async resetCandidate(
    @Param('id') id: string,
    @Body() body?: {
      performedBy?: string;
      performedByRole?: string;
      reasonCode?: string;
      reasonText?: string;
    },
  ) {
    const result = await this.candidatesService.resetCandidate(id, body);
    return result;
  }

  @Get('archive/list')
  async getArchivedCandidates() {
    return this.candidatesService.getArchivedCandidates();
  }

  @Post(':id/restore')
  async restoreCandidate(@Param('id') id: string) {
    return this.candidatesService.restoreCandidate(id);
  }

  @Delete(':id')
  async deleteCandidate(
    @Param('id') id: string,
    @Body() body?: { role?: string; id?: string; name?: string; reason?: string }
  ) {
    return this.candidatesService.deleteCandidate(id, body);
  }
}
