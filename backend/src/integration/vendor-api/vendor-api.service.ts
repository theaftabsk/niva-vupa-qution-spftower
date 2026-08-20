import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import * as crypto from 'crypto';

@Injectable()
export class VendorApiService {
  private readonly logger = new Logger(VendorApiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  private async recordLog(data: {
    vendorId: string;
    apiType: string;
    endpoint: string;
    method: string;
    status: 'SUCCESS' | 'FAILED';
    statusCode: number;
    requestBody?: any;
    responseBody?: any;
    itemsCount?: number;
    errorMessage?: string;
  }) {
    try {
      await this.prisma.vendorApiLog.create({
        data: {
          vendorId: data.vendorId,
          apiType: data.apiType,
          endpoint: data.endpoint,
          method: data.method,
          status: data.status,
          statusCode: data.statusCode,
          requestBody: data.requestBody ? JSON.stringify(data.requestBody).slice(0, 4000) : null,
          responseBody: data.responseBody ? JSON.stringify(data.responseBody).slice(0, 4000) : null,
          itemsCount: data.itemsCount || 0,
          errorMessage: data.errorMessage || null,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to record Vendor API log: ${err.message}`);
    }
  }

  private getFrontendBaseUrl(): string {
    return (
      process.env.CANDIDATE_PORTAL_URL ||
      process.env.FRONTEND_CANDIDATE_URL ||
      'https://niva.greatcampus.in'
    ).replace(/\/+$/, '');
  }

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1️⃣ INCOMING API 1: Assessment Create / Sync API
  // ─────────────────────────────────────────────────────────────────────────────
  async createOrSyncAssessment(vendor: any, body: any) {
    this.logger.log(`Vendor [${vendor.vendorCode} - ${vendor.name}] is creating/syncing assessment.`);

    if (!body || !body.name || !body.name.trim()) {
      throw new BadRequestException('Assessment "name" is required.');
    }

    const name = body.name.trim();
    const durationMins = Number(body.durationMins) || 45;
    const maxProctorWarnings = Number(body.maxProctorWarnings) || 3;
    const status = body.status ? body.status.toUpperCase() : 'ACTIVE';

    const activeFrom = body.activeFrom ? new Date(body.activeFrom) : null;
    const activeUntil = body.activeUntil ? new Date(body.activeUntil) : null;

    // Resolve slug
    let baseSlug = body.slug ? this.slugify(body.slug) : this.slugify(name);
    if (!baseSlug) baseSlug = `assessment-${Date.now()}`;

    // Check if assessment exists by ID or Slug or vendorAssessmentId
    let assessment = null;
    if (body.assessmentId) {
      assessment = await this.prisma.assessment.findUnique({
        where: { id: body.assessmentId },
      });
    }

    if (!assessment) {
      assessment = await this.prisma.assessment.findUnique({
        where: { slug: baseSlug },
      });
    }

    const tenantId = vendor.tenantId || 'default-tenant';

    // Make sure Tenant exists
    const tenantExists = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const finalTenantId = tenantExists ? tenantId : ((await this.prisma.tenant.findFirst())?.id || tenantId);

    if (assessment) {
      // Update existing assessment
      assessment = await this.prisma.assessment.update({
        where: { id: assessment.id },
        data: {
          name,
          durationMins,
          maxProctorWarnings,
          status,
          activeFrom,
          activeUntil,
          description: body.description !== undefined ? body.description : assessment.description,
        },
      });
    } else {
      // Ensure unique slug
      let uniqueSlug = baseSlug;
      let counter = 1;
      while (await this.prisma.assessment.findUnique({ where: { slug: uniqueSlug } })) {
        uniqueSlug = `${baseSlug}-${counter}`;
        counter++;
      }

      assessment = await this.prisma.assessment.create({
        data: {
          tenantId: finalTenantId,
          name,
          slug: uniqueSlug,
          description: body.description || null,
          durationMins,
          maxProctorWarnings,
          status,
          activeFrom,
          activeUntil,
        },
      });
    }

    // Ensure Vendor Assessment mapping exists
    const existingMapping = await this.prisma.vendorAssessment.findUnique({
      where: {
        vendorId_assessmentId: {
          vendorId: vendor.id,
          assessmentId: assessment.id,
        },
      },
    });

    if (!existingMapping) {
      await this.prisma.vendorAssessment.create({
        data: {
          vendorId: vendor.id,
          assessmentId: assessment.id,
          assignedBy: `API:${vendor.vendorCode}`,
          status: 'ACTIVE',
        },
      });
    }

    const frontendBaseUrl = this.getFrontendBaseUrl();
    const assessmentLink = `${frontendBaseUrl}/${assessment.slug}`;

    const responseData = {
      success: true,
      message: 'Assessment created/synced successfully.',
      data: {
        assessmentId: assessment.id,
        vendorAssessmentId: body.vendorAssessmentId || assessment.id,
        name: assessment.name,
        slug: assessment.slug,
        assessmentLink,
        durationMins: assessment.durationMins,
        totalQuestions: 60,
        status: assessment.status,
        activeFrom: assessment.activeFrom,
        activeUntil: assessment.activeUntil,
        createdAt: assessment.createdAt,
      },
    };

    await this.recordLog({
      vendorId: vendor.id,
      apiType: 'ASSESSMENT_CREATE',
      endpoint: '/api/v1/vendor-api/assessments',
      method: 'POST',
      status: 'SUCCESS',
      statusCode: 200,
      requestBody: { name: body.name, durationMins: body.durationMins, slug: body.slug },
      responseBody: { assessmentId: assessment.id, slug: assessment.slug, name: assessment.name },
      itemsCount: 1,
    });

    return responseData;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2️⃣ INCOMING API 2: Candidate Add / Assign API (Unique Link Generation)
  // ─────────────────────────────────────────────────────────────────────────────
  async addOrAssignCandidates(vendor: any, body: any) {
    this.logger.log(`Vendor [${vendor.vendorCode} - ${vendor.name}] is adding/assigning candidates.`);

    if (!body || !body.assessmentId) {
      throw new BadRequestException('Field "assessmentId" (or assessment slug) is required.');
    }

    // Resolve Assessment (by ID or Slug)
    const assessment = await this.prisma.assessment.findFirst({
      where: {
        OR: [{ id: body.assessmentId }, { slug: body.assessmentId }],
      },
    });

    if (!assessment) {
      throw new NotFoundException(`Assessment "${body.assessmentId}" not found.`);
    }

    // Ensure Vendor is mapped to this assessment
    const isMapped = await this.prisma.vendorAssessment.findUnique({
      where: {
        vendorId_assessmentId: {
          vendorId: vendor.id,
          assessmentId: assessment.id,
        },
      },
    });

    if (!isMapped) {
      await this.prisma.vendorAssessment.create({
        data: {
          vendorId: vendor.id,
          assessmentId: assessment.id,
          assignedBy: `API:${vendor.vendorCode}`,
          status: 'ACTIVE',
        },
      });
    }

    // Extract candidates list (support array or single object)
    let candidatesList: any[] = [];
    if (Array.isArray(body.candidates) && body.candidates.length > 0) {
      candidatesList = body.candidates;
    } else if (body.name && body.email) {
      candidatesList = [
        {
          name: body.name,
          email: body.email,
          phone: body.phone,
          applicationId: body.applicationId,
          vendorCandidateId: body.vendorCandidateId,
          referenceId: body.referenceId,
        },
      ];
    } else {
      throw new BadRequestException('Please provide a candidate or a list of "candidates" with name and email.');
    }

    const frontendBaseUrl = this.getFrontendBaseUrl();
    const results: any[] = [];

    for (const candItem of candidatesList) {
      if (!candItem.email || !candItem.email.trim()) {
        continue;
      }

      const email = candItem.email.trim().toLowerCase();
      const name = candItem.name ? candItem.name.trim() : 'Candidate';
      const phone = candItem.phone ? candItem.phone.trim() : '';
      const applicationId = candItem.applicationId ? candItem.applicationId.trim() : null;
      const vendorCandidateId = candItem.vendorCandidateId ? candItem.vendorCandidateId.trim() : null;

      const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      const refId = candItem.referenceId
        ? candItem.referenceId.trim()
        : applicationId || `REF-${Date.now().toString().slice(-6)}-${randomSuffix}`;

      // Check if candidate already exists in this assessment
      let candidate = await this.prisma.candidate.findFirst({
        where: {
          assessmentId: assessment.id,
          OR: [
            { email },
            ...(applicationId ? [{ applicationId }] : []),
            { referenceId: refId },
          ],
        },
      });

      // Unique token for secure candidate-specific exam link
      const secureToken = candidate?.secureToken || `sec_${crypto.randomBytes(16).toString('hex')}`;

      if (candidate) {
        // Update candidate
        candidate = await this.prisma.candidate.update({
          where: { id: candidate.id },
          data: {
            name,
            phone: phone || candidate.phone,
            vendorId: vendor.id,
            vendorCandidateId: vendorCandidateId || candidate.vendorCandidateId,
            applicationId: applicationId || candidate.applicationId,
            secureToken,
            isDeleted: false,
          },
        });
      } else {
        // Create new candidate
        candidate = await this.prisma.candidate.create({
          data: {
            name,
            email,
            phone,
            assessmentId: assessment.id,
            vendorId: vendor.id,
            applicationId,
            vendorCandidateId,
            referenceId: refId,
            secureToken,
            status: 'REGISTERED',
          },
        });
      }

      const examUrl = `${frontendBaseUrl}/${assessment.slug}?token=${secureToken}`;

      // Optional auto email if configured
      if (body.sendEmail) {
        this.emailService
          .sendCandidateInvitation(candidate.id)
          .catch((err) => this.logger.warn(`Email sending notice: ${err.message}`));
      }

      results.push({
        candidateId: candidate.id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        applicationId: candidate.applicationId || candidate.referenceId,
        vendorCandidateId: candidate.vendorCandidateId,
        secureToken: candidate.secureToken,
        examUrl,
        status: candidate.status === 'REGISTERED' ? 'NOT_STARTED' : candidate.status,
      });
    }

    const responseData = {
      success: true,
      count: results.length,
      assessmentId: assessment.id,
      assessmentName: assessment.name,
      data: results,
    };

    await this.recordLog({
      vendorId: vendor.id,
      apiType: 'CANDIDATE_ADD',
      endpoint: '/api/v1/vendor-api/candidates',
      method: 'POST',
      status: 'SUCCESS',
      statusCode: 200,
      requestBody: { assessmentId: body.assessmentId, candidateCount: results.length },
      responseBody: { count: results.length, assessmentId: assessment.id },
      itemsCount: results.length,
    });

    return responseData;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3️⃣ OUTGOING / VENDOR API 3: Active Assessments API
  // ─────────────────────────────────────────────────────────────────────────────
  async getActiveAssessments(vendor: any) {
    this.logger.log(`Vendor [${vendor.vendorCode} - ${vendor.name}] fetching active assessments.`);

    const now = new Date();
    const frontendBaseUrl = this.getFrontendBaseUrl();

    // Fetch assessments assigned to this vendor
    const vendorAssignments = await this.prisma.vendorAssessment.findMany({
      where: {
        vendorId: vendor.id,
        status: 'ACTIVE',
        assessment: {
          status: 'ACTIVE',
        },
      },
      include: {
        assessment: true,
      },
      orderBy: { assignedAt: 'desc' },
    });

    const activeList = vendorAssignments
      .map((va) => va.assessment)
      .filter((a) => {
        if (a.activeFrom && now < new Date(a.activeFrom)) return false;
        if (a.activeUntil && now > new Date(a.activeUntil)) return false;
        return true;
      });

    const formatted = activeList.map((a) => ({
      assessmentId: a.id,
      assessmentName: a.name,
      assessmentSlug: a.slug,
      assessmentLink: `${frontendBaseUrl}/${a.slug}`,
      durationMins: a.durationMins || 45,
      totalQuestions: 60,
      status: 'ACTIVE',
      activeFrom: a.activeFrom,
      activeUntil: a.activeUntil,
      createdAt: a.createdAt,
    }));

    const responseData = {
      success: true,
      count: formatted.length,
      data: formatted,
    };

    await this.recordLog({
      vendorId: vendor.id,
      apiType: 'ACTIVE_ASSESSMENTS',
      endpoint: '/api/v1/vendor-api/assessments/active',
      method: 'GET',
      status: 'SUCCESS',
      statusCode: 200,
      responseBody: { count: formatted.length },
      itemsCount: formatted.length,
    });

    return responseData;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4️⃣ OUTGOING / VENDOR API 4: Candidate Status / Result API
  // ─────────────────────────────────────────────────────────────────────────────
  async getCandidateStatus(vendor: any, query: any) {
    this.logger.log(`Vendor [${vendor.vendorCode} - ${vendor.name}] querying candidate status.`);

    const whereClause: any = {
      vendorId: vendor.id,
      isDeleted: false,
    };

    if (query.assessmentId) {
      whereClause.OR = [
        { assessmentId: query.assessmentId },
        { assessment: { slug: query.assessmentId } },
      ];
    }

    if (query.applicationId) {
      whereClause.OR = [
        { applicationId: query.applicationId },
        { referenceId: query.applicationId },
      ];
    }

    if (query.candidateId) {
      whereClause.id = query.candidateId;
    }

    if (query.vendorCandidateId) {
      whereClause.vendorCandidateId = query.vendorCandidateId;
    }

    if (query.email) {
      whereClause.email = { equals: query.email.trim().toLowerCase(), mode: 'insensitive' };
    }

    const candidates = await this.prisma.candidate.findMany({
      where: whereClause,
      include: {
        assessment: {
          select: {
            id: true,
            name: true,
            slug: true,
            durationMins: true,
            activeFrom: true,
            activeUntil: true,
          },
        },
        attempts: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    const formatted = candidates.map((c) => {
      const latestAttempt = c.attempts[0] || null;

      let computedStatus = 'NOT_STARTED';
      if (latestAttempt) {
        if (latestAttempt.status === 'COMPLETED') {
          computedStatus = 'COMPLETED';
        } else if (latestAttempt.status === 'IN_PROGRESS') {
          computedStatus = 'IN_PROGRESS';
        } else if (latestAttempt.status === 'LOCKED' || latestAttempt.status === 'DISQUALIFIED') {
          computedStatus = 'DISQUALIFIED';
        }
      } else if (c.status === 'LOCKED' || c.status === 'DISQUALIFIED') {
        computedStatus = 'DISQUALIFIED';
      } else if (c.status === 'IN_PROGRESS') {
        computedStatus = 'IN_PROGRESS';
      } else if (c.assessment?.activeUntil && now > new Date(c.assessment.activeUntil)) {
        computedStatus = 'EXPIRED';
      }

      // Time calculation
      let totalTimeSpentFormatted = '0 mins 0 secs';
      if (latestAttempt) {
        let totalSec = latestAttempt.totalTimeSpentSec || 0;
        if (latestAttempt.status === 'IN_PROGRESS' && latestAttempt.startedAt) {
          const sessionSec = Math.floor((now.getTime() - new Date(latestAttempt.startedAt).getTime()) / 1000);
          totalSec += Math.max(0, sessionSec);
        }
        totalTimeSpentFormatted = `${Math.floor(totalSec / 60)} mins ${totalSec % 60} secs`;
      }

      return {
        candidateId: c.id,
        applicationId: c.applicationId || c.referenceId,
        vendorCandidateId: c.vendorCandidateId || null,
        name: c.name,
        email: c.email,
        phone: c.phone,
        assessmentId: c.assessment?.id || c.assessmentId,
        assessmentName: c.assessment?.name || 'Assessment',
        assessmentSlug: c.assessment?.slug || '',
        status: computedStatus,
        examStartedAt: latestAttempt?.startedAt || null,
        examSubmittedAt: latestAttempt?.submittedAt || null,
        totalTimeSpent: totalTimeSpentFormatted,
        totalMarks: latestAttempt?.totalPossibleScore || 60,
        obtainedMarks: latestAttempt?.score || 0,
        percentage: latestAttempt?.percentage || 0,
        warningCount: latestAttempt?.warningCount || 0,
      };
    });

    const responseData = {
      success: true,
      count: formatted.length,
      data: formatted,
    };

    await this.recordLog({
      vendorId: vendor.id,
      apiType: 'CANDIDATE_STATUS',
      endpoint: '/api/v1/vendor-api/candidates/status',
      method: 'GET',
      status: 'SUCCESS',
      statusCode: 200,
      requestBody: query,
      responseBody: { count: formatted.length },
      itemsCount: formatted.length,
    });

    return responseData;
  }
}
