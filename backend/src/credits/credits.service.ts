import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Resolves or ensures a default Tenant exists
   */
  async getOrCreateDefaultTenant() {
    let tenant = await this.prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: {
          name: 'Niva Bupa Health Insurance',
          slug: 'niva-bupa',
          creditLimit: 500,
          usedCredit: 0,
          status: 'ACTIVE',
        },
      });

      // Initial credit history log
      await this.prisma.creditHistory.create({
        data: {
          tenantId: tenant.id,
          type: 'ALLOCATION',
          amount: 500,
          balanceAfter: 500,
          description: 'Initial System Credit Allocation (500 Credits)',
          adminName: 'Super Admin',
        },
      });
    }
    return tenant;
  }

  /**
   * Atomically checks remaining credits and consumes 1 credit when starting a fresh attempt.
   * If candidate already has an active attempt, 0 credit is deducted (Duplicate Protection).
   */
  async checkAndConsumeCredit(params: {
    tenantId: string;
    candidateId: string;
    candidateName: string;
    assessmentId: string;
    assessmentName: string;
    vendorId?: string | null;
    vendorName?: string | null;
    attemptId?: string;
  }) {
    const { tenantId, candidateId, candidateName, assessmentId, assessmentName, vendorId, vendorName, attemptId } = params;

    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch Tenant & Validate Credit Balance
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        throw new BadRequestException('Tenant organization not found.');
      }

      if (tenant.status !== 'ACTIVE') {
        throw new BadRequestException('Tenant organization account is currently suspended.');
      }

      const remaining = tenant.creditLimit - tenant.usedCredit;
      if (remaining <= 0) {
        this.logger.warn(`[Credit Exhausted] Tenant ${tenant.name} has 0 remaining exam credits!`);
        throw new BadRequestException(
          'Exam session cannot be launched. Tenant allocated exam credits have been exhausted. Please contact system administrator.',
        );
      }

      // 2. Atomically increment usedCredit for tenant
      const updatedTenant = await tx.tenant.update({
        where: { id: tenant.id },
        data: { usedCredit: { increment: 1 } },
      });

      // 3. Atomically increment vendor creditUsed if candidate belongs to a vendor
      if (vendorId) {
        await tx.vendor.update({
          where: { id: vendorId },
          data: { creditUsed: { increment: 1 } },
        }).catch(() => {});
      }

      const newRemaining = updatedTenant.creditLimit - updatedTenant.usedCredit;

      // 4. Record Audit Ledger in CreditHistory
      const history = await tx.creditHistory.create({
        data: {
          tenantId: tenant.id,
          vendorId: vendorId || null,
          vendorName: vendorName || null,
          type: 'DEDUCTION',
          amount: -1,
          balanceAfter: newRemaining,
          candidateId,
          attemptId: attemptId || null,
          description: `Exam Start: ${candidateName} — ${assessmentName}${vendorName ? ` (Vendor: ${vendorName})` : ''}`,
          adminName: 'System Engine',
        },
      });

      this.logger.log(
        `[Credit Deducted] Tenant: ${tenant.name} | Candidate: ${candidateName} | Vendor: ${vendorName || 'Direct'} | Remaining: ${newRemaining}`,
      );

      return {
        success: true,
        creditConsumed: true,
        remainingCredit: newRemaining,
        creditHistoryId: history.id,
      };
    });
  }

  /**
   * Super Admin: Add credits to tenant (+500, +1000, etc.)
   */
  async allocateCredits(tenantId: string, amount: number, adminName = 'Super Admin', notes?: string) {
    if (amount <= 0) {
      throw new BadRequestException('Allocation amount must be a positive integer greater than 0.');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found.');

    const updatedTenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { creditLimit: { increment: amount } },
    });

    const balanceAfter = updatedTenant.creditLimit - updatedTenant.usedCredit;

    const history = await this.prisma.creditHistory.create({
      data: {
        tenantId,
        type: 'ALLOCATION',
        amount,
        balanceAfter,
        description: notes || `Additional Credit Allocation (+${amount}) by ${adminName}`,
        adminName,
      },
    });

    return {
      success: true,
      tenant: updatedTenant,
      allocatedAmount: amount,
      totalLimit: updatedTenant.creditLimit,
      usedCredit: updatedTenant.usedCredit,
      remainingCredit: balanceAfter,
      history,
    };
  }

  /**
   * Super Admin: Adjust / Set Credit Limit with strict validation (cannot be lower than usedCredit)
   */
  async adjustCreditLimit(tenantId: string, newLimit: number, adminName = 'Super Admin', reason?: string) {
    if (newLimit < 0) {
      throw new BadRequestException('Credit limit cannot be negative.');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found.');

    // Strict safety check: Cannot lower limit below already used credits!
    if (newLimit < tenant.usedCredit) {
      throw new BadRequestException(
        `Cannot reduce credit limit to ${newLimit} because ${tenant.usedCredit} credits have already been consumed. Minimum allowable limit is ${tenant.usedCredit}.`,
      );
    }

    const diff = newLimit - tenant.creditLimit;

    const updatedTenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { creditLimit: newLimit },
    });

    const balanceAfter = updatedTenant.creditLimit - updatedTenant.usedCredit;

    const history = await this.prisma.creditHistory.create({
      data: {
        tenantId,
        type: 'ADJUSTMENT',
        amount: diff,
        balanceAfter,
        description: reason || `Credit Limit Adjusted to ${newLimit} (${diff >= 0 ? '+' : ''}${diff}) by ${adminName}`,
        adminName,
      },
    });

    return {
      success: true,
      tenant: updatedTenant,
      newLimit: updatedTenant.creditLimit,
      usedCredit: updatedTenant.usedCredit,
      remainingCredit: balanceAfter,
      history,
    };
  }

  /**
   * Returns paginated Credit History ledger for a tenant
   */
  async getCreditHistory(tenantId: string, page = 1, limit = 50, type?: string, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = { tenantId };
    if (type && type !== 'ALL') where.type = type;
    if (search && search.trim() !== '') {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { adminName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, histories] = await Promise.all([
      this.prisma.creditHistory.count({ where }),
      this.prisma.creditHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // Enrich logs with candidate and exam attempt info if candidateId is present
    const candidateIds = histories.map((h) => h.candidateId).filter(Boolean) as string[];
    const candidates = candidateIds.length > 0
      ? await this.prisma.candidate.findMany({
          where: { id: { in: candidateIds } },
          include: {
            assessment: { select: { name: true, slug: true } },
            attempts: {
              orderBy: { startedAt: 'desc' },
              take: 1,
              select: {
                id: true,
                status: true,
                score: true,
                totalPossibleScore: true,
                percentage: true,
                isPassed: true,
                warningCount: true,
                startedAt: true,
                submittedAt: true,
              },
            },
          },
        })
      : [];

    const candidateMap = new Map(candidates.map((c) => [c.id, c]));

    const enrichedHistories = histories.map((h) => {
      const cand = h.candidateId ? candidateMap.get(h.candidateId) : null;
      return {
        ...h,
        candidateDetails: cand
          ? {
              id: cand.id,
              name: cand.name,
              email: cand.email,
              phone: cand.phone,
              applicationId: cand.applicationId,
              assessmentName: cand.assessment?.name,
              latestAttempt: cand.attempts?.[0] || null,
            }
          : null,
      };
    });

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      histories: enrichedHistories,
    };
  }

  /**
   * Comprehensive Tenant Statistics for Dashboards
   */
  async getTenantStats(tenantId?: string) {
    const tenant = tenantId
      ? await this.prisma.tenant.findUnique({ where: { id: tenantId } })
      : await this.getOrCreateDefaultTenant();

    if (!tenant) throw new BadRequestException('Tenant not found.');

    const [totalAssessments, totalCandidates, totalAttempts, completedAttempts, inProgressAttempts] =
      await Promise.all([
        this.prisma.assessment.count({ where: { tenantId: tenant.id } }),
        this.prisma.candidate.count({ where: { assessment: { tenantId: tenant.id } } }),
        this.prisma.examAttempt.count({ where: { candidate: { assessment: { tenantId: tenant.id } } } }),
        this.prisma.examAttempt.count({
          where: {
            candidate: { assessment: { tenantId: tenant.id } },
            status: 'COMPLETED',
          },
        }),
        this.prisma.examAttempt.count({
          where: {
            candidate: { assessment: { tenantId: tenant.id } },
            status: 'IN_PROGRESS',
          },
        }),
      ]);

    const remainingCredit = Math.max(0, tenant.creditLimit - tenant.usedCredit);
    const notStartedCandidates = Math.max(0, totalCandidates - totalAttempts);

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
      },
      credit: {
        creditLimit: tenant.creditLimit,
        usedCredit: tenant.usedCredit,
        remainingCredit,
        usagePercentage:
          tenant.creditLimit > 0 ? Math.round((tenant.usedCredit / tenant.creditLimit) * 100) : 0,
        isExhausted: remainingCredit <= 0,
        isLow: remainingCredit > 0 && remainingCredit <= Math.ceil(tenant.creditLimit * 0.1),
      },
      metrics: {
        totalAssessments,
        totalCandidates,
        examAttempts: totalAttempts,
        completed: completedAttempts,
        inProgress: inProgressAttempts,
        notStarted: notStartedCandidates,
      },
    };
  }
}
