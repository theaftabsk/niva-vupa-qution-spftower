import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

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

    return vendors.map((v) => ({
      id: v.id,
      vendorCode: v.vendorCode,
      name: v.name,
      email: v.email,
      phone: v.phone,
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
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        assignedAssessments: {
          include: {
            assessment: {
              select: { id: true, name: true, slug: true, status: true, durationMins: true, passingPercentage: true, activeFrom: true, activeUntil: true },
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

    return {
      id: vendor.id,
      vendorCode: vendor.vendorCode,
      name: vendor.name,
      email: vendor.email,
      phone: vendor.phone,
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
}
