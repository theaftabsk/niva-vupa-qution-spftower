import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  private generateKey(): string {
    return `vkey_${crypto.randomBytes(16).toString('hex')}`;
  }

  async create(data: {
    name: string;
    email: string;
    password?: string;
    phone?: string;
    contactPerson?: string;
    assignedAssessmentIds?: string[];
  }) {
    const email = data.email.trim().toLowerCase();
    const existing = await this.prisma.vendor.findUnique({
      where: { email },
    });

    if (existing) {
      throw new BadRequestException(`A vendor with email "${email}" already exists. Please use a unique email address.`);
    }

    // Auto-generate vendor code (e.g. VND-1001)
    const count = await this.prisma.vendor.count();
    const vendorCode = `VND-${String(count + 1001).padStart(4, '0')}`;
    const apiKey = this.generateKey();

    // Hash password with bcrypt
    const rawPass = data.password && data.password.trim() ? data.password.trim() : 'Vendor@123';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawPass, salt);

    const vendor = await this.prisma.vendor.create({
      data: {
        vendorCode,
        name: data.name.trim(),
        email,
        passwordHash,
        apiKey,
        phone: data.phone?.trim() || null,
        contactPerson: data.contactPerson?.trim() || null,
        status: 'ACTIVE',
      },
    });

    // Assign assessments if provided
    if (data.assignedAssessmentIds && data.assignedAssessmentIds.length > 0) {
      await this.assignAssessments(vendor.id, data.assignedAssessmentIds, 'Super Admin');
    }

    return this.findOne(vendor.id);
  }

  private computeAssessmentStatus(ass: any) {
    let computedStatus = ass.status || 'ACTIVE';
    const now = new Date();
    if (computedStatus !== 'INACTIVE' && computedStatus !== 'DRAFT' && computedStatus !== 'ARCHIVED') {
      if (ass.activeFrom && now < new Date(ass.activeFrom)) computedStatus = 'UPCOMING';
      else if (ass.activeUntil && now > new Date(ass.activeUntil)) computedStatus = 'EXPIRED';
      else computedStatus = 'ACTIVE';
    }
    return {
      ...ass,
      status: computedStatus,
    };
  }

  async findAll() {
    const vendors = await this.prisma.vendor.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        assignedAssessments: {
          include: {
            assessment: {
              select: { id: true, name: true, slug: true, status: true, durationMins: true, activeFrom: true, activeUntil: true },
            },
          },
        },
        _count: {
          select: {
            candidates: true,
            assignedAssessments: true,
          },
        },
      },
    });

    // Backfill any missing apiKeys
    for (const v of vendors) {
      if (!v.apiKey) {
        const newKey = this.generateKey();
        await this.prisma.vendor.update({
          where: { id: v.id },
          data: { apiKey: newKey },
        });
        v.apiKey = newKey;
      }
    }

    return vendors.map((v) => ({
      id: v.id,
      vendorCode: v.vendorCode,
      name: v.name,
      email: v.email,
      phone: v.phone,
      apiKey: v.apiKey,
      contactPerson: v.contactPerson,
      status: v.status,
      creditUsed: v.creditUsed,
      totalCandidates: v._count.candidates,
      totalAssessments: v._count.assignedAssessments,
      assignedAssessments: v.assignedAssessments.map((va) => this.computeAssessmentStatus(va.assessment)),
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));
  }

  async findOne(id: string) {
    let vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        assignedAssessments: {
          include: {
            assessment: {
              select: { id: true, name: true, slug: true, status: true, durationMins: true, activeFrom: true, activeUntil: true },
            },
          },
        },
        _count: {
          select: {
            candidates: true,
          },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor not found with ID ${id}`);
    }

    if (!vendor.apiKey) {
      const newKey = this.generateKey();
      vendor = await this.prisma.vendor.update({
        where: { id },
        data: { apiKey: newKey },
        include: {
          assignedAssessments: {
            include: {
              assessment: {
                select: { id: true, name: true, slug: true, status: true, durationMins: true, activeFrom: true, activeUntil: true },
              },
            },
          },
          _count: {
            select: {
              candidates: true,
            },
          },
        },
      });
    }

    return {
      id: vendor.id,
      vendorCode: vendor.vendorCode,
      name: vendor.name,
      email: vendor.email,
      phone: vendor.phone,
      apiKey: vendor.apiKey,
      contactPerson: vendor.contactPerson,
      status: vendor.status,
      creditUsed: vendor.creditUsed,
      totalCandidates: vendor._count.candidates,
      assignedAssessments: vendor.assignedAssessments.map((va) => this.computeAssessmentStatus(va.assessment)),
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt,
    };
  }

  async update(
    id: string,
    data: {
      name?: string;
      phone?: string;
      contactPerson?: string;
      status?: string;
      password?: string;
      assignedAssessmentIds?: string[];
    },
  ) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) {
      throw new NotFoundException(`Vendor not found with ID ${id}`);
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
    if (data.contactPerson !== undefined) updateData.contactPerson = data.contactPerson?.trim() || null;
    if (data.status !== undefined) updateData.status = data.status;

    if (data.password && data.password.trim()) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(data.password.trim(), salt);
    }

    await this.prisma.vendor.update({
      where: { id },
      data: updateData,
    });

    if (data.assignedAssessmentIds !== undefined) {
      await this.assignAssessments(id, data.assignedAssessmentIds, 'Admin');
    }

    return this.findOne(id);
  }

  async assignAssessments(vendorId: string, assessmentIds: string[], assignedBy = 'Admin') {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    // Remove existing assignments not in the new list
    await this.prisma.vendorAssessment.deleteMany({
      where: {
        vendorId,
        assessmentId: { notIn: assessmentIds },
      },
    });

    // Add new assignments
    for (const assessmentId of assessmentIds) {
      const existing = await this.prisma.vendorAssessment.findUnique({
        where: {
          vendorId_assessmentId: { vendorId, assessmentId },
        },
      });

      if (!existing) {
        await this.prisma.vendorAssessment.create({
          data: {
            vendorId,
            assessmentId,
            assignedBy,
            status: 'ACTIVE',
          },
        });
      }
    }

    return this.findOne(vendorId);
  }

  async delete(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    // Unlink candidates from vendor (set vendorId = null) rather than deleting candidates
    await this.prisma.candidate.updateMany({
      where: { vendorId: id },
      data: { vendorId: null },
    });

    await this.prisma.vendor.delete({
      where: { id },
    });

    return { success: true, message: `Vendor "${vendor.name}" removed successfully.` };
  }

  async regenerateApiKey(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundException(`Vendor not found with ID ${id}`);

    const newKey = this.generateKey();
    await this.prisma.vendor.update({
      where: { id },
      data: { apiKey: newKey },
    });

    return {
      success: true,
      apiKey: newKey,
      message: 'API Key regenerated successfully.',
    };
  }

  async reassignCandidates(candidateIds: string[], toVendorId: string | null) {
    if (!candidateIds || candidateIds.length === 0) {
      throw new BadRequestException('No candidate IDs provided.');
    }

    let vendorName = 'Direct / Unassigned';
    if (toVendorId) {
      const targetVendor = await this.prisma.vendor.findUnique({ where: { id: toVendorId } });
      if (!targetVendor) throw new NotFoundException('Target vendor not found.');
      vendorName = targetVendor.name;
    }

    const updated = await this.prisma.candidate.updateMany({
      where: { id: { in: candidateIds } },
      data: { vendorId: toVendorId },
    });

    return {
      success: true,
      count: updated.count,
      message: `Successfully reassigned ${updated.count} candidate(s) to ${vendorName}.`,
    };
  }

  async getVendorDashboardDetails(id: string) {
    const vendor: any = await (this.prisma as any).vendor.findUnique({
      where: { id },
      include: {
        assignedAssessments: {
          include: {
            assessment: true,
          },
        },
        candidates: {
          where: { isDeleted: false },
          include: {
            assessment: { select: { id: true, name: true, slug: true } },
            attempts: {
              orderBy: { startedAt: 'desc' },
              take: 1,
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        apiLogs: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!vendor) throw new NotFoundException('Vendor not found');

    const totalCandidates = vendor.candidates?.length || 0;
    let notStarted = 0;
    let inProgress = 0;
    let completed = 0;
    let disqualified = 0;

    const frontendBaseUrl = (
      process.env.CANDIDATE_PORTAL_URL ||
      process.env.FRONTEND_CANDIDATE_URL ||
      'https://niva.greatcampus.in'
    ).replace(/\/+$/, '');

    const candidatesList = (vendor.candidates || []).map((c: any) => {
      const latestAttempt = c.attempts?.[0] || null;
      let status = 'NOT_STARTED';

      if (latestAttempt) {
        if (latestAttempt.status === 'COMPLETED') {
          status = 'COMPLETED';
          completed++;
        } else if (latestAttempt.status === 'IN_PROGRESS') {
          status = 'IN_PROGRESS';
          inProgress++;
        } else if (latestAttempt.status === 'LOCKED' || latestAttempt.status === 'DISQUALIFIED') {
          status = 'DISQUALIFIED';
          disqualified++;
        }
      } else if (c.status === 'LOCKED' || c.status === 'DISQUALIFIED') {
        status = 'DISQUALIFIED';
        disqualified++;
      } else if (c.status === 'IN_PROGRESS') {
        status = 'IN_PROGRESS';
        inProgress++;
      } else {
        notStarted++;
      }

      const examSlug = c.assessment?.slug || c.assessmentId;
      const examUrl = c.secureToken ? `${frontendBaseUrl}/${examSlug}?token=${c.secureToken}` : `${frontendBaseUrl}/${examSlug}`;

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        applicationId: c.applicationId || c.referenceId,
        vendorCandidateId: c.vendorCandidateId,
        assessmentName: c.assessment?.name || 'Assessment',
        assessmentSlug: c.assessment?.slug || '',
        status,
        examUrl,
        score: latestAttempt?.score || 0,
        percentage: latestAttempt?.percentage || 0,
        startedAt: latestAttempt?.startedAt || null,
        submittedAt: latestAttempt?.submittedAt || null,
        createdAt: c.createdAt,
      };
    });

    const tenant = await this.prisma.tenant.findFirst();
    const creditLimit = tenant?.creditLimit || 500;
    const creditUsed = vendor.creditUsed || 0;

    return {
      success: true,
      vendor: {
        id: vendor.id,
        vendorCode: vendor.vendorCode,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        contactPerson: vendor.contactPerson,
        apiKey: vendor.apiKey,
        status: vendor.status,
        creditLimit,
        creditUsed,
        creditRemaining: Math.max(0, creditLimit - creditUsed),
        createdAt: vendor.createdAt,
      },
      stats: {
        totalCandidates,
        notStarted,
        inProgress,
        completed,
        disqualified,
        totalAssessments: vendor.assignedAssessments?.length || 0,
        totalApiCalls: vendor.apiLogs?.length || 0,
      },
      assignedAssessments: (vendor.assignedAssessments || []).map((va: any) => ({
        id: va.assessment.id,
        name: va.assessment.name,
        slug: va.assessment.slug,
        status: va.assessment.status,
        durationMins: va.assessment.durationMins,
        assignedAt: va.assignedAt,
        candidatesCount: (vendor.candidates || []).filter((c: any) => c.assessmentId === va.assessmentId).length,
      })),
      candidates: candidatesList,
      apiLogs: vendor.apiLogs || [],
    };
  }

  async getAllVendorApiLogs(query: { vendorId?: string; apiType?: string; status?: string; page?: number; limit?: number }) {
    const where: any = {};
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.apiType) where.apiType = query.apiType;
    if (query.status) where.status = query.status;

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      (this.prisma as any).vendorApiLog.count({ where }),
      (this.prisma as any).vendorApiLog.findMany({
        where,
        include: {
          vendor: {
            select: { id: true, name: true, vendorCode: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      success: true,
      total,
      page,
      limit,
      logs,
    };
  }

  async getAllVendorActivityLogs(query: { vendorId?: string; limit?: number }) {
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 50));
    const vendorWhere = query.vendorId ? { vendorId: query.vendorId } : {};

    const [recentCandidates, recentAttempts, recentApiLogs] = await Promise.all([
      this.prisma.candidate.findMany({
        where: { ...vendorWhere, isDeleted: false },
        include: {
          vendor: { select: { id: true, name: true, vendorCode: true } },
          assessment: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.examAttempt.findMany({
        where: query.vendorId ? { candidate: { vendorId: query.vendorId } } : {},
        include: {
          candidate: {
            include: {
              vendor: { select: { id: true, name: true, vendorCode: true } },
              assessment: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        take: limit,
      }),
      (this.prisma as any).vendorApiLog.findMany({
        where: vendorWhere,
        include: {
          vendor: { select: { id: true, name: true, vendorCode: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    // Merge into single chronological timeline
    const activities: any[] = [];

    for (const c of recentCandidates) {
      activities.push({
        id: `cand_${c.id}`,
        vendorName: c.vendor?.name || 'Direct',
        vendorCode: c.vendor?.vendorCode || 'N/A',
        action: 'CANDIDATE_ADDED',
        title: `Candidate Added: ${c.name}`,
        details: `Application: ${c.applicationId || c.referenceId} | Assessment: ${c.assessment?.name || 'Assessment'}`,
        timestamp: c.createdAt,
      });
    }

    for (const att of recentAttempts) {
      if (att.status === 'COMPLETED' && att.submittedAt) {
        activities.push({
          id: `submit_${att.id}`,
          vendorName: att.candidate.vendor?.name || 'Direct',
          vendorCode: att.candidate.vendor?.vendorCode || 'N/A',
          action: 'EXAM_COMPLETED',
          title: `Exam Completed: ${att.candidate.name}`,
          details: `Score: ${att.score}/${att.totalPossibleScore} (${att.percentage}%)`,
          timestamp: att.submittedAt,
        });
      } else {
        activities.push({
          id: `start_${att.id}`,
          vendorName: att.candidate.vendor?.name || 'Direct',
          vendorCode: att.candidate.vendor?.vendorCode || 'N/A',
          action: 'EXAM_STARTED',
          title: `Exam Started: ${att.candidate.name}`,
          details: `Assessment: ${att.candidate.assessment?.name || 'Assessment'}`,
          timestamp: att.startedAt,
        });
      }
    }

    for (const log of recentApiLogs) {
      activities.push({
        id: `api_${log.id}`,
        vendorName: log.vendor.name,
        vendorCode: log.vendor.vendorCode,
        action: 'API_CALL',
        title: `API Call: ${log.apiType} (${log.method} ${log.endpoint})`,
        details: `Status: ${log.status} (${log.statusCode}) | Items: ${log.itemsCount}`,
        timestamp: log.createdAt,
      });
    }

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      success: true,
      count: activities.length,
      activities: activities.slice(0, limit),
    };
  }
}
