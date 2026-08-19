import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const EXAM_DURATION_MINS = 45;
const TOTAL_QUESTIONS = 60;

@Injectable()
export class AssessmentsService {
  constructor(private prisma: PrismaService) {}

  private async getOrCreateTenant() {
    let tenant = await this.prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: { name: 'Niva Bupa Health Insurance', slug: 'niva-bupa' },
      });
    }
    return tenant;
  }

  async getAssessments(vendorIdentifier?: string) {
    const whereClause: any = {
      status: { not: 'ARCHIVED' },
    };

    if (vendorIdentifier && vendorIdentifier.trim() !== '') {
      const cleanId = vendorIdentifier.trim();
      const vendor = await this.prisma.vendor.findFirst({
        where: {
          OR: [
            { id: cleanId },
            { vendorCode: cleanId },
            { email: cleanId },
          ],
        },
      });

      const actualVendorId = vendor ? vendor.id : cleanId;

      whereClause.vendorAssignments = {
        some: {
          vendorId: actualVendorId,
        },
      };
    }

    const assessments = await this.prisma.assessment.findMany({
      where: whereClause,
      include: {
        _count: { select: { candidates: true } },
        vendorAssignments: {
          include: {
            vendor: {
              select: { id: true, name: true, vendorCode: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const frontendBaseUrl = process.env.CANDIDATE_PORTAL_URL || process.env.FRONTEND_CANDIDATE_URL || 'http://localhost:3002';
    const now = new Date();

    return assessments.map((ass) => {
      let computedStatus = 'ACTIVE';
      if (ass.status === 'INACTIVE' || ass.status === 'DRAFT' || ass.status === 'ARCHIVED') {
        computedStatus = ass.status;
      } else {
        if (ass.activeFrom && now < new Date(ass.activeFrom)) {
          computedStatus = 'UPCOMING';
        } else if (ass.activeUntil && now > new Date(ass.activeUntil)) {
          computedStatus = 'EXPIRED';
        } else {
          computedStatus = 'ACTIVE';
        }
      }

      return {
        id: ass.id,
        name: ass.name,
        slug: ass.slug,
        description: ass.description,
        status: computedStatus,
        activeFrom: ass.activeFrom,
        activeUntil: ass.activeUntil,
        passingPercentage: ass.passingPercentage,
        maxProctorWarnings: ass.maxProctorWarnings,
        createdAt: ass.createdAt,
        totalCandidates: ass._count.candidates,
        durationMins: ass.durationMins || EXAM_DURATION_MINS,
        totalQuestions: TOTAL_QUESTIONS,
        assignedVendors: ass.vendorAssignments.map((va) => va.vendor),
        uniqueCandidateLink: `${frontendBaseUrl}/${ass.slug || ass.id}`,
      };
    });
  }

  async getAssessmentById(id: string) {
    const assessment = await this.prisma.assessment.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: {
        _count: { select: { candidates: true } },
        vendorAssignments: {
          include: {
            vendor: {
              select: { id: true, name: true, vendorCode: true },
            },
          },
        },
      },
    });

    if (!assessment) {
      throw new NotFoundException(`Assessment not found`);
    }

    const frontendBaseUrl = process.env.FRONTEND_CANDIDATE_URL || 'http://localhost:3002';

    return {
      ...assessment,
      durationMins: assessment.durationMins || EXAM_DURATION_MINS,
      totalQuestions: TOTAL_QUESTIONS,
      assignedVendors: assessment.vendorAssignments.map((va) => va.vendor),
      uniqueCandidateLink: `${frontendBaseUrl}/${assessment.slug || assessment.id}`,
    };
  }

  async saveAssessment(
    data: {
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
    userRole?: string,
  ) {
    if (userRole === 'VENDOR') {
      throw new ForbiddenException("You don't have permission to create or modify assessments. Only Admin can manage assessments.");
    }

    const tenant = await this.getOrCreateTenant();
    const slug = data.slug || (data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now().toString().slice(-4));

    const now = new Date();
    let finalActiveFrom: Date | null | undefined = undefined;
    if (data.activeFrom === null) {
      finalActiveFrom = null;
    } else if (data.activeFrom && typeof data.activeFrom === 'string' && data.activeFrom.trim() !== '') {
      const d = new Date(data.activeFrom);
      if (!isNaN(d.getTime())) finalActiveFrom = d;
    }

    let finalActiveUntil: Date | null | undefined = undefined;
    if (data.activeUntil === null) {
      finalActiveUntil = null;
    } else if (data.activeUntil && typeof data.activeUntil === 'string' && data.activeUntil.trim() !== '') {
      const d = new Date(data.activeUntil);
      if (!isNaN(d.getTime())) finalActiveUntil = d;
    }

    if (!data.id) {
      if (finalActiveFrom === undefined) finalActiveFrom = now;
      if (finalActiveUntil === undefined) finalActiveUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    if (data.id && data.status === 'ACTIVE') {
      const existing = await this.prisma.assessment.findUnique({ where: { id: data.id } });
      if (existing) {
        const targetUntil = finalActiveUntil !== undefined ? finalActiveUntil : existing.activeUntil;
        if (targetUntil && now > targetUntil) {
          throw new Error('Cannot activate an expired assessment session. Please edit the session and set a future Until end date.');
        }
      }
    }

    const payload: any = {
      name: data.name,
      slug,
      description: data.description || '',
      durationMins: 45,
      passingPercentage: data.passingPercentage !== undefined ? Number(data.passingPercentage) : 50,
      maxProctorWarnings: data.maxProctorWarnings !== undefined ? Number(data.maxProctorWarnings) : 3,
      status: data.status || 'ACTIVE',
      ...(finalActiveFrom !== undefined && { activeFrom: finalActiveFrom }),
      ...(finalActiveUntil !== undefined && { activeUntil: finalActiveUntil }),
    };

    let assessment: any;
    if (data.id) {
      assessment = await this.prisma.assessment.update({
        where: { id: data.id },
        data: payload,
      });

      await this.prisma.examAttempt.updateMany({
        where: {
          candidate: { assessmentId: data.id },
          status: { in: ['IN_PROGRESS', 'LOCKED'] },
        },
        data: {
          durationMinsSnapshot: payload.durationMins,
          passingPercentageSnapshot: payload.passingPercentage,
          maxProctorWarningsSnapshot: payload.maxProctorWarnings,
        },
      });
    } else {
      assessment = await this.prisma.assessment.create({
        data: {
          tenantId: tenant.id,
          ...payload,
        },
      });
    }

    // If assignedVendorIds provided, sync VendorAssessment
    if (data.assignedVendorIds !== undefined) {
      await this.prisma.vendorAssessment.deleteMany({
        where: {
          assessmentId: assessment.id,
          vendorId: { notIn: data.assignedVendorIds },
        },
      });

      for (const vendorId of data.assignedVendorIds) {
        const existing = await this.prisma.vendorAssessment.findUnique({
          where: {
            vendorId_assessmentId: { vendorId, assessmentId: assessment.id },
          },
        });
        if (!existing) {
          await this.prisma.vendorAssessment.create({
            data: {
              vendorId,
              assessmentId: assessment.id,
              status: 'ACTIVE',
              assignedBy: 'Admin',
            },
          });
        }
      }
    }

    return this.getAssessmentById(assessment.id);
  }

  async deleteAssessment(id: string, userRole?: string) {
    if (userRole === 'VENDOR') {
      throw new ForbiddenException("You don't have permission to delete assessments. Only Admin can manage assessments.");
    }

    const candidateCount = await this.prisma.candidate.count({ where: { assessmentId: id } });
    if (candidateCount > 0) {
      // Safe Soft-delete to preserve candidate attempts & scorecards
      return this.prisma.assessment.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
    }

    // Hard delete if no candidates exist
    await this.prisma.vendorAssessment.deleteMany({ where: { assessmentId: id } });
    return this.prisma.assessment.delete({ where: { id } });
  }
}
