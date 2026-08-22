import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HeadstartClientService } from '../integration/headstart/headstart-client.service';
import { HeadstartWebhookService } from '../integration/headstart/headstart-webhook.service';
import { EmailService } from '../email/email.service';
import { CreditsService } from '../credits/credits.service';
import * as ExcelJS from 'exceljs';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ─── SYSTEM CONSTANTS ─────────────────────────────────────────────────────────
// These are fixed for ALL assessments. Admins cannot override them.
const EXAM_DURATION_MINS = 45;
const TOTAL_QUESTIONS = 60;
const MAX_PROCTOR_WARNINGS = 6;
// ──────────────────────────────────────────────────────────────────────────────

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(
    private prisma: PrismaService,
    private headstartClient: HeadstartClientService,
    private headstartWebhook: HeadstartWebhookService,
    private emailService: EmailService,
    private creditsService: CreditsService,
  ) { }

  // ─── GET CANDIDATES ────────────────────────────────────────────────────────
  async getCandidates(assessmentId?: string, vendorId?: string) {
    const whereClause: any = { isDeleted: false };
    if (assessmentId) whereClause.assessmentId = assessmentId;
    if (vendorId) whereClause.vendorId = vendorId;

    const candidates = await this.prisma.candidate.findMany({
      where: whereClause,
      include: {
        assessment: true,
        vendor: {
          select: { id: true, name: true, vendorCode: true },
        },
        attempts: {
          orderBy: { startedAt: 'desc' },
          include: {
            attemptQuestions: {
              include: { question: true },
            },
            submissions: true,
            proctoringLogs: { orderBy: { timestamp: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const frontendBaseUrl = process.env.CANDIDATE_PORTAL_URL || process.env.FRONTEND_CANDIDATE_URL || 'https://niva.greatcampus.in';

    return candidates.map((cand) => {
      const latestAttempt = cand.attempts[0] || null;
      let questionAudit: any[] = [];

      if (latestAttempt) {
        questionAudit = latestAttempt.attemptQuestions.map((aq) => {
          const q = aq.question;
          const sub = latestAttempt.submissions.find((s) => s.questionId === q.id);
          return {
            questionOrder: aq.questionOrder,
            questionText: q.question,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            selectedOption: sub?.selectedOption || null,
            correctAnswer: q.correctAnswer,
            isCorrect: sub?.isCorrect || false,
            marks: aq.marks,
          };
        });
      }

      const examSlug = cand.assessment?.slug || cand.assessmentId;
      const uniqueExamLink = cand.secureToken
        ? `${frontendBaseUrl}/${examSlug}?token=${cand.secureToken}`
        : `${frontendBaseUrl}/${examSlug}`;

      return {
        id: cand.id,
        name: cand.name,
        email: cand.email,
        phone: cand.phone,
        applicationId: cand.applicationId,
        referenceId: cand.referenceId,
        secureToken: cand.secureToken,
        emailStatus: cand.emailStatus || 'PENDING',
        emailSentAt: cand.emailSentAt,
        uniqueExamLink,
        status: cand.status,
        vendorId: cand.vendorId || null,
        vendor: cand.vendor || null,
        createdAt: cand.createdAt,
        assessment: {
          id: cand.assessment.id,
          name: cand.assessment.name,
          slug: cand.assessment.slug,
        },
        attempt: latestAttempt
          ? {
            id: latestAttempt.id,
            status: latestAttempt.status,
            startedAt: latestAttempt.startedAt,
            submittedAt: latestAttempt.submittedAt,
            score: latestAttempt.score,
            totalPossibleScore: latestAttempt.totalPossibleScore,
            percentage: latestAttempt.percentage,
            isPassed: latestAttempt.isPassed,
            warningCount: latestAttempt.warningCount,
            maxProctorWarnings: latestAttempt.maxProctorWarningsSnapshot,
            durationMins: EXAM_DURATION_MINS,
            lockedAt: latestAttempt.lockedAt,
            lockReason: latestAttempt.lockReason,
            unlockedAt: latestAttempt.unlockedAt,
            unlockedByAdminName: latestAttempt.unlockedByAdminName,
            questionAudit,
            proctoringLogs: latestAttempt.proctoringLogs,
          }
          : null,
      };
    });
  }

  // ─── REGISTER CANDIDATE ────────────────────────────────────────────────────
  async registerCandidate(data: {
    name: string;
    email: string;
    phone: string;
    assessmentId: string;
    referenceId?: string;
    applicationId?: string;
    vendorId?: string;
  }) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: data.assessmentId } });
    if (!assessment) {
      throw new NotFoundException(`Assigned Assessment not found.`);
    }

    const refId = data.referenceId || `REF-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const existing = await this.prisma.candidate.findFirst({
      where: {
        OR: [
          { referenceId: refId },
          { email: data.email },
          ...(data.applicationId ? [{ applicationId: data.applicationId }] : []),
        ],
      },
    });

    if (existing) {
      return this.prisma.candidate.update({
        where: { id: existing.id },
        data: {
          assessmentId: data.assessmentId,
          name: data.name,
          phone: data.phone,
          ...(data.applicationId && { applicationId: data.applicationId }),
          ...(data.vendorId && { vendorId: data.vendorId }),
        },
        include: { assessment: true, vendor: true },
      });
    }

    const newCandidate = await this.prisma.candidate.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        referenceId: refId,
        applicationId: data.applicationId || null,
        assessmentId: data.assessmentId,
        vendorId: data.vendorId || null,
      },
      include: { assessment: true, vendor: true },
    });

    // Auto-dispatch invitation email
    this.emailService
      .sendCandidateInvitation(newCandidate.id)
      .catch((err) => this.logger.error(`[Register Auto Email Error] ${err.message}`));

    return newCandidate;
  }

  // ─── VERIFY AND START EXAM (Strict Email & Assignment Authorization) ───────
  async verifyAndStartExam(data: {
    applicationId?: string;
    assessmentId?: string;
    identifier?: string;
    name?: string;
    email?: string;
    phone?: string;
  }) {
    const rawId = data.assessmentId || data.identifier || 'aa-2812';
    const email = data.email?.trim().toLowerCase();
    const appId = data.applicationId?.trim();

    if (!email && !appId) {
      throw new BadRequestException('Candidate email or Application ID is required.');
    }

    this.logger.log(`Verifying candidate email: '${email}', AppID: '${appId}', Assessment: '${rawId}'`);

    // Resolve Assessment from DB (by ID or Slug)
    let assessment = await this.prisma.assessment.findFirst({
      where: { OR: [{ id: rawId }, { slug: rawId }] },
    });

    if (!assessment) {
      assessment = await this.prisma.assessment.findFirst({ where: { status: 'ACTIVE' } });
    }

    if (!assessment) {
      throw new NotFoundException('Assessment session not found.');
    }

    const actualAssessmentId = assessment.id;

    // Check if assessment session is active/expired
    const now = new Date();
    if (assessment.activeFrom && now < new Date(assessment.activeFrom)) {
      throw new BadRequestException(`This assessment has not started yet. Access opens at ${new Date(assessment.activeFrom).toLocaleString()}.`);
    }
    if (assessment.activeUntil && now > new Date(assessment.activeUntil)) {
      throw new BadRequestException('This assessment session link has expired. Please contact your HR Administrator.');
    }
    if (assessment.status === 'INACTIVE') {
      throw new BadRequestException('This assessment session is currently inactive.');
    }

    // STRICT CHECK: Find pre-assigned candidate in this assessment session
    const candidateFilterOr: any[] = [];
    if (email) {
      candidateFilterOr.push({ email: { equals: email, mode: 'insensitive' } });
    }
    if (appId) {
      candidateFilterOr.push({ applicationId: { equals: appId, mode: 'insensitive' } });
      candidateFilterOr.push({ referenceId: { equals: appId, mode: 'insensitive' } });
    }

    let candidate = await this.prisma.candidate.findFirst({
      where: {
        assessmentId: actualAssessmentId,
        OR: candidateFilterOr,
      },
      include: {
        assessment: true,
        attempts: {
          orderBy: { startedAt: 'desc' },
        },
      },
    });

    // If not found directly in this assessment, check if registered in any active session
    if (!candidate) {
      candidate = await this.prisma.candidate.findFirst({
        where: {
          OR: candidateFilterOr,
        },
        include: {
          assessment: true,
          attempts: {
            orderBy: { startedAt: 'desc' },
          },
        },
      });
    }

    // STRICT REJECTION: If candidate email is NOT in the database, deny access!
    if (!candidate) {
      throw new ForbiddenException(
        `Access Denied: The email '${data.email || data.applicationId}' is not registered or assigned to this assessment. Please use your registered email or contact your HR Administrator.`
      );
    }

    // Check if candidate already has a COMPLETED attempt
    const latestAttempt = candidate.attempts ? candidate.attempts[0] : null;
    if (latestAttempt && latestAttempt.status === 'COMPLETED') {
      const completedTime = latestAttempt.submittedAt || latestAttempt.startedAt || new Date();
      throw new BadRequestException(
        `You have already completed this assessment on ${new Date(completedTime).toLocaleString()}. Multiple attempts are not permitted.`
      );
    }

    // Check if candidate is LOCKED or DISQUALIFIED
    if (candidate.status === 'LOCKED' || candidate.status === 'DISQUALIFIED' || latestAttempt?.status === 'LOCKED' || latestAttempt?.status === 'DISQUALIFIED') {
      throw new BadRequestException(
        `Your exam session is currently LOCKED due to security flags (${latestAttempt?.warningCount || 3} warnings). Please contact your HR Administrator to unlock your exam.`
      );
    }

    // Update name / phone snapshot if candidate provided fresh values
    if (data.name || data.phone) {
      await this.prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.phone && { phone: data.phone }),
        },
      });
    }

    // Start exam session
    const sessionData = await this.startExamSession(candidate.id);

    // Fire API 4 Status Webhook (Status = Started)
    if (sessionData && sessionData.attemptId) {
      await this.headstartWebhook.sendAssessmentStatus(sessionData.attemptId, 'Started');
    }

    return {
      ...sessionData,
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        applicationId: candidate.applicationId || candidate.referenceId,
        referenceId: candidate.referenceId,
        assessmentId: candidate.assessmentId,
      },
    };
  }

  // ─── START EXAM SESSION ────────────────────────────────────────────────────
  // Fixed: EXAM_DURATION_MINS = 45, TOTAL_QUESTIONS = 60 from Shared Question Bank
  async startExamSession(candidateIdentifier: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { OR: [{ id: candidateIdentifier }, { referenceId: candidateIdentifier }] },
      include: { assessment: true, vendor: true },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found.');
    }

    // Check for an existing active attempt (resume support)
    const activeAttempt = await this.prisma.examAttempt.findFirst({
      where: {
        candidateId: candidate.id,
        status: 'IN_PROGRESS',
      },
      include: {
        attemptQuestions: {
          orderBy: { questionOrder: 'asc' },
          include: { question: true },
        },
        submissions: true,
      },
    });

    if (activeAttempt) {
      // Calculate accurate remaining time:
      // total available seconds - (totalTimeSpentSec from previous sessions + seconds spent in current active session)
      const totalDurationSec = (activeAttempt.durationMinsSnapshot || candidate.assessment.durationMins || EXAM_DURATION_MINS) * 60;
      const now = Date.now();
      const currentSessionElapsed = activeAttempt.startedAt
        ? Math.floor((now - new Date(activeAttempt.startedAt).getTime()) / 1000)
        : 0;
      const totalSpentSec = (activeAttempt.totalTimeSpentSec || 0) + Math.max(0, currentSessionElapsed);
      const remainingTimeSec = Math.max(30, totalDurationSec - totalSpentSec);

      // Return the existing attempt so candidate can resume seamlessly
      return {
        candidate: {
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          referenceId: candidate.referenceId,
        },
        attemptId: activeAttempt.id,
        assessmentName: candidate.assessment.name,
        durationMins: activeAttempt.durationMinsSnapshot || candidate.assessment.durationMins || EXAM_DURATION_MINS,
        remainingTimeSec,
        maxProctorWarnings: activeAttempt.maxProctorWarningsSnapshot,
        warningCount: activeAttempt.warningCount,
        questions: activeAttempt.attemptQuestions.map((aq) => ({
          attemptQuestionId: aq.id,
          id: aq.question.id,
          subjectId: '',
          subjectName: aq.question.sectionName || 'General',
          sectionId: '',
          sectionName: aq.question.sectionName || 'General',
          question: aq.question.question,
          optionA: aq.question.optionA,
          optionB: aq.question.optionB,
          optionC: aq.question.optionC,
          optionD: aq.question.optionD,
          marks: aq.marks,
          selectedOption: activeAttempt.submissions.find((s) => s.questionId === aq.questionId)?.selectedOption || null,
        })),
      };
    }

    const currentAttemptNum = (candidate.totalAttemptsCount || 0) + 1;

    // Check & Consume 1 Exam Credit (Duplicate Protected — Only consumed once per attempt)
    await this.creditsService.checkAndConsumeCredit({
      tenantId: candidate.assessment.tenantId,
      candidateId: candidate.id,
      candidateName: candidate.name,
      assessmentId: candidate.assessment.id,
      assessmentName: candidate.assessment.name,
      vendorId: candidate.vendorId,
      vendorName: candidate.vendor?.name,
      attemptNumber: currentAttemptNum,
    });

    // Create a new attempt with configurable session minute snapshot
    const attempt = await this.prisma.examAttempt.create({
      data: {
        candidateId: candidate.id,
        status: 'IN_PROGRESS',
        creditConsumed: true,
        durationMinsSnapshot: candidate.assessment.durationMins || EXAM_DURATION_MINS,
        passingPercentageSnapshot: candidate.assessment.passingPercentage || 50.0,
        maxProctorWarningsSnapshot: candidate.assessment.maxProctorWarnings || MAX_PROCTOR_WARNINGS,
        startedAt: new Date(),
      },
    });

    // Fetch all active questions from the Shared Question Bank
    const allQuestions = await this.prisma.question.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      take: TOTAL_QUESTIONS,
    });

    if (allQuestions.length === 0) {
      throw new BadRequestException('No active questions found in the question bank. Please contact the administrator.');
    }

    // Create AttemptQuestion records (1 per question, sequential order)
    await this.prisma.attemptQuestion.createMany({
      data: allQuestions.map((q, idx) => ({
        attemptId: attempt.id,
        questionId: q.id,
        questionOrder: idx + 1,
        marks: q.marks || 1.0,
      })),
    });

    // Update candidate status and increment totalAttemptsCount
    await this.prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        status: 'IN_PROGRESS',
        totalAttemptsCount: { increment: 1 },
      },
    });

    // Retrieve the created attempt with questions
    const createdAttempt = await this.prisma.examAttempt.findUnique({
      where: { id: attempt.id },
      include: {
        attemptQuestions: {
          orderBy: { questionOrder: 'asc' },
          include: { question: true },
        },
      },
    });

    if (!createdAttempt) {
      throw new NotFoundException('Failed to retrieve created exam attempt.');
    }

    return {
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        referenceId: candidate.referenceId,
      },
      attemptId: createdAttempt.id,
      assessmentName: candidate.assessment.name,
      durationMins: createdAttempt.durationMinsSnapshot,
      maxProctorWarnings: createdAttempt.maxProctorWarningsSnapshot,
      warningCount: 0,
      questions: createdAttempt.attemptQuestions.map((aq) => ({
        attemptQuestionId: aq.id,
        id: aq.question.id,
        question: aq.question.question,
        optionA: aq.question.optionA,
        optionB: aq.question.optionB,
        optionC: aq.question.optionC,
        optionD: aq.question.optionD,
        marks: aq.marks,
        selectedOption: null,
      })),
    };
  }

  // ─── SUBMIT EXAM ───────────────────────────────────────────────────────────
  async submitExam(attemptId: string, answers: Record<string, any>) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        attemptQuestions: { include: { question: true } },
        candidate: true,
      },
    });

    if (!attempt) throw new NotFoundException('Exam attempt not found.');

    // If candidate is already LOCKED, DISQUALIFIED, or reached max warnings, preserve LOCKED status!
    if (attempt.status === 'LOCKED' || attempt.status === 'DISQUALIFIED' || attempt.warningCount >= attempt.maxProctorWarningsSnapshot) {
      this.logger.warn(`Submit attempted for LOCKED candidate attempt ${attemptId}. Preserving LOCKED status.`);
      return attempt;
    }
    if (attempt.status === 'COMPLETED') {
      return attempt;
    }

    let totalScore = 0;
    let totalPossibleScore = 0;

    const checkAnswerMatch = (selected: string | null, correctAnswer: string): boolean => {
      if (!selected || !correctAnswer) return false;
      const selNorm = selected.trim().toUpperCase().replace(/^OPTION\s+/, '');
      const corNorm = correctAnswer.trim().toUpperCase().replace(/^OPTION\s+/, '');
      return selNorm === corNorm;
    };

    // Delete any draft submissions recorded during real-time save to ensure exact 1 submission per question
    await this.prisma.submission.deleteMany({
      where: { attemptId: attempt.id },
    });

    for (const aq of attempt.attemptQuestions) {
      const q = aq.question;
      const ansObj = answers[q.id] || answers[aq.id] || answers[aq.questionId];
      let selected: string | null = null;

      if (typeof ansObj === 'string') {
        selected = ansObj;
      } else if (ansObj && typeof ansObj === 'object') {
        selected = ansObj.selectedOption || null;
      }

      const isCorrect = checkAnswerMatch(selected, q.correctAnswer);
      const timeTaken = (ansObj && typeof ansObj === 'object' && ansObj.timeTakenSec) ? ansObj.timeTakenSec : 0;

      totalPossibleScore += aq.marks;
      if (isCorrect) totalScore += aq.marks;

      await this.prisma.submission.create({
        data: {
          attemptId: attempt.id,
          questionId: q.id,
          selectedOption: selected,
          isCorrect,
          timeTakenSec: timeTaken,
        },
      });
    }

    const percentage = totalPossibleScore > 0 ? Math.round((totalScore / totalPossibleScore) * 100) : 0;
    const isPassed = percentage >= attempt.passingPercentageSnapshot;
    const submittedAt = new Date();

    let sessionSeconds = 0;
    if (attempt.startedAt) {
      sessionSeconds = Math.max(0, Math.floor((submittedAt.getTime() - new Date(attempt.startedAt).getTime()) / 1000));
    }
    const finalTotalTimeSpentSec = (attempt.totalTimeSpentSec || 0) + sessionSeconds;

    // ─── STEP 1: DB save FIRST (submittedAt + result must be persisted before webhooks) ───
    const updatedAttempt = await this.prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        submittedAt,
        status: 'COMPLETED',
        score: totalScore,
        totalPossibleScore,
        percentage,
        isPassed,
        totalTimeSpentSec: finalTotalTimeSpentSec,
      },
    });

    await this.prisma.candidate.update({
      where: { id: attempt.candidateId },
      data: { status: 'COMPLETED' },
    });

    // ─── STEP 2: Fire Headstart OUT Webhooks AFTER DB is fully updated ─────────
    // Order guaranteed: API 4 (COMPLETED) → API 5 (Result) → API 6 (Report Card)
    try {
      await this.headstartWebhook.sendAssessmentStatus(updatedAttempt.id, 'Completed');
      await this.headstartWebhook.sendAssessmentResultAndReportCard(updatedAttempt.id);
    } catch (err) {
      this.logger.error(`Error firing post-submission webhooks: ${err.message}`);
    }

    return updatedAttempt;
  }

  // ─── REAL-TIME ANSWER PERSISTENCE ─────────────────────────────────────────
  async saveAnswer(data: {
    attemptId: string;
    questionId: string;
    selectedOption: string | null;
    timeTakenSec?: number;
  }) {
    const { attemptId, questionId, selectedOption, timeTakenSec = 0 } = data;

    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException('Exam attempt not found.');
    if (attempt.status === 'LOCKED' || attempt.status === 'COMPLETED' || attempt.status === 'DISQUALIFIED') {
      throw new BadRequestException(`Cannot save answer. Exam session is ${attempt.status}.`);
    }

    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });
    const isCorrect = !!(
      question &&
      selectedOption &&
      question.correctAnswer?.trim().toUpperCase() === selectedOption?.trim().toUpperCase()
    );

    const existingSub = await this.prisma.submission.findFirst({
      where: { attemptId, questionId },
    });

    let submission;
    if (existingSub) {
      submission = await this.prisma.submission.update({
        where: { id: existingSub.id },
        data: {
          selectedOption,
          isCorrect,
          timeTakenSec: (existingSub.timeTakenSec || 0) + (timeTakenSec || 0),
        },
      });
    } else {
      submission = await this.prisma.submission.create({
        data: {
          attemptId,
          questionId,
          selectedOption,
          isCorrect,
          timeTakenSec: timeTakenSec || 0,
        },
      });
    }

    return {
      success: true,
      message: 'Answer saved in real-time.',
      submissionId: submission.id,
      questionId,
      selectedOption,
    };
  }

  // ─── CHECK ATTEMPT LOCK / RESUME STATUS ────────────────────────────────────
  async checkAttemptStatus(attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { candidate: true },
    });
    if (!attempt) throw new NotFoundException('Attempt not found.');

    const totalDurationSec = (attempt.durationMinsSnapshot || EXAM_DURATION_MINS) * 60;
    const now = Date.now();
    let currentSessionElapsed = 0;
    if (attempt.status === 'IN_PROGRESS' && attempt.startedAt) {
      currentSessionElapsed = Math.floor((now - new Date(attempt.startedAt).getTime()) / 1000);
    }
    const totalSpent = (attempt.totalTimeSpentSec || 0) + Math.max(0, currentSessionElapsed);
    const remainingTimeSec = Math.max(0, totalDurationSec - totalSpent);

    return {
      success: true,
      attemptId: attempt.id,
      status: attempt.status,
      warningCount: attempt.warningCount,
      maxProctorWarnings: attempt.maxProctorWarningsSnapshot,
      lockReason: attempt.lockReason,
      remainingTimeSec,
      isUnlocked: attempt.status === 'IN_PROGRESS',
    };
  }

  // ─── PROCTORING ────────────────────────────────────────────────────────────
  async logProctoringEvent(attemptId: string, eventType: string, details?: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { candidate: { include: { assessment: true } } },
    });
    if (!attempt) throw new NotFoundException('Exam attempt not found.');

    // Check if a warning was already logged in the last 3.5 seconds (avoids double counting simultaneous TAB_SWITCH + FULLSCREEN_EXIT)
    const recentLog = await this.prisma.proctoringLog.findFirst({
      where: { attemptId: attempt.id },
      orderBy: { timestamp: 'desc' },
    });

    const isDuplicateBurst = recentLog && (Date.now() - new Date(recentLog.timestamp).getTime()) < 3500;

    // Log the proctoring event for full security audit trail
    await this.prisma.proctoringLog.create({
      data: { attemptId: attempt.id, eventType, details },
    });

    const maxWarnings = attempt.candidate?.assessment?.maxProctorWarnings || attempt.maxProctorWarningsSnapshot || MAX_PROCTOR_WARNINGS;
    const newWarningCount = isDuplicateBurst ? attempt.warningCount : attempt.warningCount + 1;
    const isTabClose = eventType === 'TAB_CLOSE' || eventType === 'WINDOW_CLOSE';
    const isDisqualified = (newWarningCount >= maxWarnings) || isTabClose;
    const lockReason = isTabClose
      ? `Exam LOCKED: Candidate closed the browser window/tab directly at ${new Date().toLocaleTimeString()}`
      : isDisqualified
        ? `Locked after ${newWarningCount} proctoring violations. Last event: ${eventType}`
        : undefined;

    let sessionSeconds = 0;
    if (attempt.startedAt) {
      sessionSeconds = Math.max(0, Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000));
    }
    const newTotalSpent = (attempt.totalTimeSpentSec || 0) + sessionSeconds;

    const updatedAttempt = await this.prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        warningCount: newWarningCount,
        maxProctorWarningsSnapshot: maxWarnings,
        ...(isDisqualified && {
          status: 'LOCKED',
          submittedAt: null,
          lockedAt: new Date(),
          lockReason,
          totalTimeSpentSec: newTotalSpent,
        }),
      },
    });

    if (isDisqualified) {
      // Lock candidate status to LOCKED
      await this.prisma.candidate.update({
        where: { id: attempt.candidateId },
        data: { status: 'LOCKED' },
      });

      // Fire LOCKED status webhook to Headstart CRM (API 4) if enabled
      await this.headstartWebhook.sendAssessmentStatus(attempt.id, 'LOCKED').catch(() => { });
    }

    return {
      warningCount: updatedAttempt.warningCount,
      maxProctorWarnings: maxWarnings,
      disqualified: isDisqualified,
      lockedAt: updatedAttempt.lockedAt,
      lockReason: updatedAttempt.lockReason,
      message: isDisqualified
        ? `🔒 Exam LOCKED: Maximum ${maxWarnings} proctoring warnings reached. Contact your HR Administrator to unlock.`
        : `Warning ${updatedAttempt.warningCount}/${maxWarnings}: Proctoring violation logged.`,
    };
  }

  // ─── CANDIDATE MANAGEMENT ──────────────────────────────────────────────────

  // Unlock candidate (Admin action) — keeps warning history, only resets lock
  async unlockCandidate(id: string, adminId: string, adminName: string, reason?: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: { attempts: { orderBy: { startedAt: 'desc' }, take: 1 } },
    });
    if (!candidate) throw new NotFoundException('Candidate not found.');

    const latestAttempt = candidate.attempts[0];
    if (!latestAttempt) throw new BadRequestException('No exam attempt found for this candidate.');

    // Resolve valid Admin ID for foreign key constraint
    const adminRecord =
      (await this.prisma.admin.findFirst({
        where: { OR: [{ id: adminId }, { username: adminName }] },
      })) || (await this.prisma.admin.findFirst());

    const resolvedAdminId = adminRecord ? adminRecord.id : null;

    // Unlock the attempt — reset current cycle warningCount to 0 (lifetime history preserved in proctoringLogs)
    // startedAt reset to now() so new active timer session starts fresh against remaining duration
    await this.prisma.examAttempt.update({
      where: { id: latestAttempt.id },
      data: {
        status: 'IN_PROGRESS',
        warningCount: 0,
        startedAt: new Date(),
        submittedAt: null,
        unlockedAt: new Date(),
        unlockedByAdminId: resolvedAdminId || adminId,
        unlockedByAdminName: adminName,
      },
    });

    // Create audit log if valid admin found
    if (resolvedAdminId) {
      await this.prisma.adminActionLog
        .create({
          data: {
            attemptId: latestAttempt.id,
            adminId: resolvedAdminId,
            action: 'UNLOCK',
            reason: reason || 'Admin unlocked candidate',
          },
        })
        .catch((e) => this.logger.warn(`Failed to create AdminActionLog: ${e.message}`));
    }

    // Update candidate status back to IN_PROGRESS
    const updatedCandidate = await this.prisma.candidate.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
      include: { assessment: true },
    });

    // Fire UNLOCKED webhook to Headstart CRM
    await this.headstartWebhook.sendAssessmentStatus(latestAttempt.id, 'UNLOCKED').catch(() => { });

    return {
      success: true,
      message: `Candidate '${candidate.name}' has been unlocked. Previous warnings kept in audit log.`,
      candidate: updatedCandidate,
      unlockedAt: new Date(),
      unlockedBy: adminName,
      reason: reason || 'Admin manual unlock',
    };
  }

  // Full Reset Candidate Attempt & Re-invite (Clean & Send) with Audit Logging
  async resetCandidate(
    id: string,
    options?: {
      performedBy?: string;
      performedByRole?: string;
      reasonCode?: string;
      reasonText?: string;
    },
  ) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: {
        assessment: true,
        vendor: true,
        attempts: {
          include: {
            screenshots: true,
          },
          orderBy: { startedAt: 'desc' },
        },
      },
    });
    if (!candidate) throw new NotFoundException('Candidate not found.');

    const previousAttempt = candidate.attempts[0] || null;
    const previousStatus = previousAttempt ? previousAttempt.status : candidate.status;
    const previousScore = previousAttempt ? previousAttempt.score : null;
    const previousWarnings = previousAttempt ? previousAttempt.warningCount : null;
    const currentAttemptNumber = candidate.totalAttemptsCount || (candidate.attempts.length > 0 ? candidate.attempts.length : 1);

    const attemptIds = candidate.attempts.map((a) => a.id);

    if (attemptIds.length > 0) {
      // 0. Physically delete proctoring screenshot files from disk
      for (const att of candidate.attempts) {
        if (att.screenshots && att.screenshots.length > 0) {
          for (const ss of att.screenshots) {
            try {
              if (ss.imageUrl) {
                const cleanRel = ss.imageUrl.replace(/^\//, '');
                const filePath = path.join(process.cwd(), cleanRel);
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                  this.logger.log(`[Reset] Deleted proctoring screenshot file: ${filePath}`);
                }
              }
            } catch (err: any) {
              this.logger.warn(`[Reset] Could not delete screenshot file: ${err.message}`);
            }
          }
        }
      }

      // 1. Delete associated submissions
      await this.prisma.submission.deleteMany({
        where: { attemptId: { in: attemptIds } },
      });

      // 2. Delete associated attempt questions
      await this.prisma.attemptQuestion.deleteMany({
        where: { attemptId: { in: attemptIds } },
      });

      // 3. Delete proctoring screenshots
      await this.prisma.proctoringScreenshot.deleteMany({
        where: { attemptId: { in: attemptIds } },
      });

      // 4. Delete proctoring logs
      await this.prisma.proctoringLog.deleteMany({
        where: { attemptId: { in: attemptIds } },
      });

      // 5. Delete exam attempts
      await this.prisma.examAttempt.deleteMany({
        where: { id: { in: attemptIds } },
      });
    }

    // Generate fresh secure token
    const newSecureToken = `sec_${crypto.randomBytes(16).toString('hex')}`;

    // Reset candidate profile to REGISTERED & increment resetsCount
    const updatedCandidate = await this.prisma.candidate.update({
      where: { id },
      data: {
        status: 'REGISTERED',
        emailStatus: 'PENDING',
        emailSentAt: null,
        secureToken: newSecureToken,
        resetsCount: (candidate.resetsCount || 0) + 1,
      },
      include: { assessment: true, vendor: true },
    });

    // Automatically attempt to dispatch fresh invitation email if SMTP is configured
    let emailResult = { success: false, message: 'SMTP not configured' };
    try {
      emailResult = await this.emailService.sendCandidateInvitation(candidate.id);
    } catch (err: any) {
      this.logger.warn(`Could not send re-invitation email: ${err.message}`);
    }

    const frontendBaseUrl = process.env.CANDIDATE_PORTAL_URL || process.env.FRONTEND_CANDIDATE_URL || 'https://niva.greatcampus.in';
    const assessmentSlug = updatedCandidate.assessment?.slug || updatedCandidate.assessmentId;
    const examUrl = `${frontendBaseUrl}/${assessmentSlug}?token=${newSecureToken}`;

    // Default reason descriptions
    const reasonMap: Record<string, string> = {
      DISQUALIFICATION_RECOVERY: 'Disqualification Recovery (3 Proctoring Warnings / Tab Switch)',
      TECHNICAL_GLITCH: 'Technical / Network / Browser Interruption',
      EXPIRED_WINDOW: 'Assessment Window Expired / Re-invite Request',
      RETAKE_APPROVAL: 'Management / Vendor Retake Approval',
      TESTING_VERIFICATION: 'Internal Testing & QA Verification',
      OTHER: options?.reasonText || 'Custom Reason',
    };

    const reasonCode = options?.reasonCode || 'DISQUALIFICATION_RECOVERY';
    const reasonText = options?.reasonText || reasonMap[reasonCode] || reasonCode;

    // Record Audit Log Entry in CandidateResetLog
    let resetLog = null;
    try {
      resetLog = await this.prisma.candidateResetLog.create({
        data: {
          candidateId: candidate.id,
          vendorId: candidate.vendorId || null,
          performedBy: options?.performedBy || 'ADMIN:System Administrator',
          performedByRole: options?.performedByRole || 'ADMIN',
          action: 'RESET_AND_RESEND',
          reasonCode,
          reasonText,
          previousStatus: previousStatus || 'REGISTERED',
          previousScore: previousScore !== null ? Number(previousScore) : null,
          previousWarnings: previousWarnings !== null ? Number(previousWarnings) : null,
          attemptNumber: currentAttemptNumber,
          newSecureToken,
          newExamUrl: examUrl,
          emailDispatched: emailResult.success,
        },
      });
    } catch (logErr: any) {
      this.logger.error(`Could not record CandidateResetLog: ${logErr.message}`);
    }

    return {
      success: true,
      message: emailResult.success
        ? `Candidate exam session wiped and fresh invitation sent to ${candidate.email}`
        : `Candidate exam session wiped and reset to Registered. Candidate can take the test now.`,
      emailDispatched: emailResult.success,
      candidate: updatedCandidate,
      resetLog,
      examUrl,
    };
  }

  // Retrieve Master Reset & Re-attempt Audit Logs (Admin only)
  async getCandidateResetAuditLogs(query: {
    vendorId?: string;
    candidateSearch?: string;
    performedByRole?: string;
    reasonCode?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(500, Number(query.limit) || 25));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.vendorId && query.vendorId !== 'ALL') {
      where.vendorId = query.vendorId;
    }

    if (query.performedByRole && query.performedByRole !== 'ALL') {
      where.performedByRole = query.performedByRole;
    }

    if (query.reasonCode && query.reasonCode !== 'ALL') {
      where.reasonCode = query.reasonCode;
    }

    if (query.candidateSearch) {
      const q = query.candidateSearch.trim();
      where.candidate = {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { applicationId: { contains: q, mode: 'insensitive' } },
          { referenceId: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const [total, logs] = await Promise.all([
      this.prisma.candidateResetLog.count({ where }),
      this.prisma.candidateResetLog.findMany({
        where,
        include: {
          candidate: {
            include: {
              assessment: { select: { id: true, name: true, slug: true } },
            },
          },
          vendor: { select: { id: true, name: true, vendorCode: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // Get full lifecycle timeline for candidate details page
  async getCandidateTimelineHistory(id: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: {
        assessment: true,
        vendor: true,
        attempts: {
          include: { proctoringLogs: true },
          orderBy: { startedAt: 'desc' },
        },
        resetLogs: {
          orderBy: { createdAt: 'desc' },
          include: { vendor: true },
        },
        emailLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!candidate) throw new NotFoundException('Candidate not found.');

    return {
      success: true,
      data: candidate,
    };
  }

  async deleteCandidate(id: string, deletedBy?: { role?: string; id?: string; name?: string; reason?: string }) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: { vendor: true },
    });

    if (!candidate) {
      throw new NotFoundException(`Candidate '${id}' not found.`);
    }

    const role = deletedBy?.role || (candidate.vendorId ? 'VENDOR' : 'ADMIN');
    const name = deletedBy?.name || (role === 'VENDOR' ? (candidate.vendor?.name || 'Vendor') : 'Administrator');

    const softDeleted = await this.prisma.candidate.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedByRole: role,
        deletedById: deletedBy?.id || candidate.vendorId || null,
        deletedByName: name,
        deletedReason: deletedBy?.reason || 'Moved to archive',
      },
    });

    this.logger.log(`Candidate '${candidate.name}' (${candidate.id}) safely moved to archive by ${role}: ${name}.`);

    return {
      success: true,
      message: `Candidate '${candidate.name}' has been safely archived.`,
      candidate: softDeleted,
    };
  }

  async getArchivedCandidates() {
    const list = await this.prisma.candidate.findMany({
      where: { isDeleted: true },
      include: {
        assessment: { select: { id: true, name: true, slug: true } },
        vendor: { select: { id: true, name: true, vendorCode: true, email: true } },
        attempts: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          select: { id: true, status: true, score: true, totalPossibleScore: true, percentage: true },
        },
      },
      orderBy: { deletedAt: 'desc' },
    });

    return {
      success: true,
      count: list.length,
      candidates: list.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        applicationId: c.applicationId,
        referenceId: c.referenceId,
        status: c.status,
        assessment: c.assessment,
        vendor: c.vendor,
        deletedAt: c.deletedAt,
        deletedByRole: c.deletedByRole,
        deletedById: c.deletedById,
        deletedByName: c.deletedByName,
        deletedReason: c.deletedReason,
        latestAttempt: c.attempts[0] || null,
      })),
    };
  }

  async restoreCandidate(id: string) {
    const candidate = await this.prisma.candidate.findUnique({ where: { id } });
    if (!candidate) throw new NotFoundException(`Candidate '${id}' not found.`);

    const restored = await this.prisma.candidate.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedByRole: null,
        deletedById: null,
        deletedByName: null,
        deletedReason: null,
      },
    });

    this.logger.log(`Candidate '${candidate.name}' (${id}) restored from archive.`);

    return {
      success: true,
      message: `Candidate '${candidate.name}' has been restored to active status successfully.`,
      candidate: restored,
    };
  }

  // ─── ASSESSMENT SESSION MANAGEMENT ────────────────────────────────────────
  async getAllAssessments() {
    const assessments = await this.prisma.assessment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { candidates: true } },
      },
    });

    const frontendBaseUrl = process.env.CANDIDATE_PORTAL_URL || process.env.FRONTEND_CANDIDATE_URL || 'http://localhost:3000';

    return assessments.map((ass) => {
      // Auto-compute status based on activeFrom/activeUntil
      const now = new Date();
      let computedStatus = ass.status;
      if (ass.activeFrom && now < new Date(ass.activeFrom)) {
        computedStatus = 'UPCOMING';
      } else if (ass.activeUntil && now > new Date(ass.activeUntil)) {
        computedStatus = 'EXPIRED';
      }

      return {
        id: ass.id,
        name: ass.name,
        slug: ass.slug,
        description: ass.description,
        passingPercentage: ass.passingPercentage,
        maxProctorWarnings: ass.maxProctorWarnings,
        status: computedStatus,
        activeFrom: ass.activeFrom,
        activeUntil: ass.activeUntil,
        createdAt: ass.createdAt,
        totalCandidates: ass._count.candidates,
        durationMins: ass.durationMins || EXAM_DURATION_MINS,
        totalQuestions: TOTAL_QUESTIONS,
        uniqueCandidateLink: `${frontendBaseUrl}/${ass.slug || ass.id}`,
      };
    });
  }

  async getAssessmentByIdentifier(identifier: string) {
    const assessment = await this.prisma.assessment.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
      },
    });

    if (!assessment) {
      throw new NotFoundException(`Assessment session '${identifier}' not found.`);
    }

    const now = new Date();

    // Check if session hasn't started yet (activeFrom in the future)
    const isNotStarted = !!(assessment.activeFrom && now < new Date(assessment.activeFrom));

    // Check if session has expired (activeUntil in the past) — computed at runtime, NOT persisted to DB
    let isExpired = assessment.status === 'INACTIVE';
    if (!isNotStarted && assessment.activeUntil && now > new Date(assessment.activeUntil)) {
      isExpired = true;
    }

    const frontendBaseUrl = process.env.CANDIDATE_PORTAL_URL || process.env.FRONTEND_CANDIDATE_URL || 'http://localhost:3000';

    return {
      id: assessment.id,
      name: assessment.name,
      slug: assessment.slug,
      description: assessment.description,
      status: isExpired ? 'EXPIRED' : (isNotStarted ? 'UPCOMING' : 'ACTIVE'),
      activeFrom: assessment.activeFrom,
      activeUntil: assessment.activeUntil,
      durationMins: assessment.durationMins || EXAM_DURATION_MINS,
      totalQuestions: TOTAL_QUESTIONS,
      isExpired,
      isNotStarted,
      uniqueCandidateLink: `${frontendBaseUrl}/${assessment.slug || assessment.id}`,
    };
  }

  async createOrUpdateAssessment(data: {
    id?: string;
    name: string;
    slug?: string;
    description?: string;
    durationMins?: number;
    activeFrom?: string;       // ISO datetime string — when link becomes accessible
    activeUntil?: string;      // ISO datetime string — when link expires
    activeHours?: number;      // convenience: set activeUntil = now + activeHours
    passingPercentage?: number;
    maxProctorWarnings?: number;
    status?: string;
  }) {
    const tenant = await this.prisma.tenant.findFirst();
    if (!tenant) throw new NotFoundException('Default tenant not found.');

    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Resolve activeFrom
    const activeFrom = data.activeFrom ? new Date(data.activeFrom) : null;

    // Resolve activeUntil — prefer explicit ISO, else compute from activeHours
    let activeUntil: Date | null = null;
    if (data.activeUntil) {
      activeUntil = new Date(data.activeUntil);
    } else if (data.activeHours && data.activeHours > 0) {
      activeUntil = new Date(Date.now() + data.activeHours * 3600 * 1000);
    }

    const payload: any = {
      name: data.name,
      slug,
      description: data.description,
      durationMins: data.durationMins ? Number(data.durationMins) : 45,
      passingPercentage: data.passingPercentage ? Number(data.passingPercentage) : 50.0,
      maxProctorWarnings: data.maxProctorWarnings ? Number(data.maxProctorWarnings) : MAX_PROCTOR_WARNINGS,
      status: data.status || 'ACTIVE',
      ...(activeFrom !== null && { activeFrom }),
      ...(activeUntil !== null && { activeUntil }),
    };

    if (data.id) {
      const updated = await this.prisma.assessment.update({ where: { id: data.id }, data: payload });
      // Synchronize in-progress and locked attempts so candidate sessions immediately reflect new duration, passing percentage, and max warnings
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
      return updated;
    }

    return this.prisma.assessment.create({
      data: {
        tenantId: tenant.id,
        ...payload,
        description: payload.description || 'Assessment Session',
      },
    });
  }

  async deleteAssessment(id: string) {
    return this.prisma.assessment.delete({ where: { id: id } });
  }

  // ─── CANDIDATE DIAGNOSTIC REPORT CARD ENGINE ──────────────────────────────
  async getCandidateReport(candidateId: string) {
    const candidate: any = await (this.prisma.candidate as any).findUnique({
      where: { id: candidateId },
      include: {
        assessment: true,
        attempts: {
          orderBy: { startedAt: 'desc' },
          include: {
            attemptQuestions: {
              orderBy: { questionOrder: 'asc' },
              include: { question: true },
            },
            submissions: {
              include: { question: true },
            },
            proctoringLogs: {
              orderBy: { timestamp: 'asc' },
            },
            adminActions: {
              orderBy: { createdAt: 'desc' },
            },
            screenshots: {
              orderBy: { capturedAt: 'desc' },
            },
          },
        },
      },
    });

    if (!candidate) {
      throw new NotFoundException(`Candidate with ID '${candidateId}' not found.`);
    }

    const latestAttempt = candidate.attempts ? candidate.attempts[0] : null;
    if (!latestAttempt) {
      throw new NotFoundException(`No exam attempt records found for candidate '${candidate.name}'.`);
    }

    // Determine status badge
    let isPassed = latestAttempt.isPassed;
    let resultStatus = 'NOT QUALIFIED';
    if (latestAttempt.status === 'LOCKED') {
      resultStatus = 'LOCKED';
    } else if (latestAttempt.status === 'DISQUALIFIED') {
      resultStatus = 'DISQUALIFIED';
    } else if (isPassed || (latestAttempt.percentage >= (latestAttempt.passingPercentageSnapshot || 50))) {
      resultStatus = 'QUALIFIED';
      isPassed = true;
    }

    // Time calculation
    const startTime = latestAttempt.startedAt ? new Date(latestAttempt.startedAt).getTime() : Date.now();
    const endTime = latestAttempt.submittedAt
      ? new Date(latestAttempt.submittedAt).getTime()
      : latestAttempt.lockedAt
        ? new Date(latestAttempt.lockedAt).getTime()
        : Date.now();

    const durationSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));
    const mins = Math.floor(durationSeconds / 60);
    const secs = durationSeconds % 60;
    const durationFormatted = `${mins} mins ${secs} secs`;

    // Pre-initialize exact 6 official Niva Bupa sections
    const officialSections = [
      { sectionOrder: 1, name: 'Communication & Customer Handling', questionRange: 'Q1–10', minQ: 1, maxQ: 10, total: 0, correct: 0, marks: 0 },
      { sectionOrder: 2, name: 'Advanced English & Comprehension', questionRange: 'Q11–20', minQ: 11, maxQ: 20, total: 0, correct: 0, marks: 0 },
      { sectionOrder: 3, name: 'Mental Ability & Reasoning', questionRange: 'Q21–30', minQ: 21, maxQ: 30, total: 0, correct: 0, marks: 0 },
      { sectionOrder: 4, name: 'Numerical & Mathematical Reasoning', questionRange: 'Q31–40', minQ: 31, maxQ: 40, total: 0, correct: 0, marks: 0 },
      { sectionOrder: 5, name: 'Banking & Financial Awareness', questionRange: 'Q41–50', minQ: 41, maxQ: 50, total: 0, correct: 0, marks: 0 },
      { sectionOrder: 6, name: 'Sales Orientation & Situational Judgement', questionRange: 'Q51–60', minQ: 51, maxQ: 60, total: 0, correct: 0, marks: 0 },
    ];

    // Load full 60 questions list sequentially
    let questionsList: any[] = [];
    if (latestAttempt.attemptQuestions && latestAttempt.attemptQuestions.length > 0) {
      questionsList = latestAttempt.attemptQuestions
        .slice()
        .sort((a: any, b: any) => (a.questionOrder || 0) - (b.questionOrder || 0))
        .map((aq: any) => ({
          questionOrder: aq.questionOrder,
          questionId: aq.questionId || aq.question?.id,
          question: aq.question,
          marks: aq.marks || 1,
        }));
    } else {
      const allQuestions = await this.prisma.question.findMany({
        where: { status: 'ACTIVE' },
        orderBy: [{ sectionOrder: 'asc' }, { createdAt: 'asc' }],
      });
      questionsList = allQuestions.slice(0, 60).map((q: any, i: number) => ({
        questionOrder: i + 1,
        questionId: q.id,
        question: q,
        marks: q.marks || 1,
      }));
    }

    let calculatedObtainedMarks = 0;
    let calculatedTotalPossible = 0;

    const responses: Array<{
      questionOrder: number;
      sectionName: string;
      questionText: string;
      candidateOption: string | null;
      correctOption: string;
      isCorrect: boolean;
      marks: number;
    }> = [];

    const submissions = latestAttempt.submissions || [];

    questionsList.slice(0, 60).forEach((item: any, idx: number) => {
      const qOrder = idx + 1;
      const questionMarks = item.marks || 1;
      const q = item.question;
      const sub = submissions.find((s: any) => s.questionId === item.questionId || s.question?.id === item.questionId);

      const isAttempted = !!(sub && sub.selectedOption);
      const isCorrect = isAttempted && !!sub.isCorrect;
      const candidateOption = isAttempted ? sub.selectedOption : 'Not Attempted';

      const secIdx = Math.min(5, Math.floor(idx / 10));
      const targetSec = officialSections[secIdx];
      targetSec.total += 1;
      targetSec.marks += questionMarks;

      if (isCorrect) {
        targetSec.correct += 1;
        calculatedObtainedMarks += questionMarks;
      }
      calculatedTotalPossible += questionMarks;

      responses.push({
        questionOrder: qOrder,
        sectionName: targetSec.name,
        questionText: q?.question || 'Question Text',
        candidateOption: isAttempted ? candidateOption : 'Not Attempted',
        correctOption: q?.correctAnswer || 'Option A',
        isCorrect,
        marks: isCorrect ? questionMarks : 0,
      });
    });

    // Structure sections array strictly into 6 objects
    const sections = officialSections.map((sec) => ({
      sectionOrder: sec.sectionOrder,
      name: sec.name,
      questionRange: sec.questionRange,
      score: sec.correct,
      totalMarks: sec.total,
      percentage: sec.total > 0 ? Math.round((sec.correct / sec.total) * 100) : 0,
    }));

    // Proctoring audit timeline
    const proctoringLogs = latestAttempt.proctoringLogs || [];
    const proctoringEvents = proctoringLogs.map((log: any) => ({
      id: log.id,
      eventType: log.eventType,
      details: log.details,
      timestamp: log.timestamp || log.createdAt,
    }));

    // Screenshots Gallery
    const screenshots = (latestAttempt.screenshots || []).map((s: any) => ({
      id: s.id,
      type: s.type,
      eventType: s.eventType,
      imageUrl: s.imageUrl,
      capturedAt: s.capturedAt,
    }));

    // Admin Remarks / Audit logs
    const adminActions = latestAttempt.adminActions || [];
    const remarks = adminActions.map((action: any) => ({
      id: action.id,
      adminId: action.adminId,
      action: action.action,
      reason: action.reason,
      createdAt: action.createdAt,
    }));

    const assessmentObj = candidate.assessment || {};

    return {
      success: true,
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        applicationId: candidate.applicationId || candidate.referenceId,
        crmCandidateId: candidate.crmCandidateId,
        status: candidate.status,
      },
      assessment: {
        id: assessmentObj.id || candidate.assessmentId,
        title: assessmentObj.name || 'Assessment Session',
        slug: assessmentObj.slug || '',
        durationMins: latestAttempt.durationMinsSnapshot || assessmentObj.durationMins || 45,
        passingPercentage: latestAttempt.passingPercentageSnapshot || assessmentObj.passingPercentage || 50,
      },
      result: {
        status: resultStatus,
        isPassed,
        score: latestAttempt.score || calculatedObtainedMarks,
        totalMarks: latestAttempt.totalPossibleScore || calculatedTotalPossible || 60,
        percentage: latestAttempt.percentage || (calculatedTotalPossible > 0 ? Math.round((calculatedObtainedMarks / calculatedTotalPossible) * 100) : 0),
      },
      timing: {
        startedAt: latestAttempt.startedAt,
        submittedAt: latestAttempt.submittedAt || latestAttempt.lockedAt,
        durationSeconds,
        durationFormatted,
      },
      sections,
      responses,
      proctoring: {
        warningCount: latestAttempt.warningCount,
        maxWarnings: latestAttempt.maxProctorWarningsSnapshot,
        lockReason: latestAttempt.lockReason,
        events: proctoringEvents,
      },
      screenshots,
      remarks,
    };
  }

  async saveCandidateRemarks(candidateId: string, adminId: string, remarkText: string) {
    const candidate: any = await (this.prisma.candidate as any).findUnique({
      where: { id: candidateId },
      include: { attempts: { orderBy: { startedAt: 'desc' } } },
    });

    if (!candidate) throw new NotFoundException('Candidate not found.');

    const latestAttempt = candidate.attempts[0];
    if (!latestAttempt) throw new NotFoundException('No attempt found.');

    const admin = (await this.prisma.admin.findFirst()) || { id: adminId };

    const actionLog = await this.prisma.adminActionLog.create({
      data: {
        attemptId: latestAttempt.id,
        adminId: admin.id,
        action: 'REMARK',
        reason: remarkText,
      },
    });

    return { success: true, remark: actionLog };
  }

  // ─── DEDICATED ASSESSMENT DASHBOARD ────────────────────────────────────────
  async getAssessmentDashboard(assessmentId: string, vendorIdentifier?: string) {
    let resolvedVendorId: string | undefined = undefined;
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
      resolvedVendorId = vendor ? vendor.id : cleanId;
    }

    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        candidates: {
          where: {
            ...(resolvedVendorId ? { vendorId: resolvedVendorId } : {}),
            isDeleted: false,
          },
          include: {
            vendor: {
              select: { id: true, name: true, vendorCode: true },
            },
            attempts: {
              orderBy: { startedAt: 'desc' },
              include: {
                submissions: true,
                proctoringLogs: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!assessment) throw new NotFoundException('Assessment session not found.');

    const totalCandidates = assessment.candidates.length;
    let invitedCount = 0;
    let startedCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;
    let lockedCount = 0;
    let qualifiedCount = 0;
    let notQualifiedCount = 0;

    const frontendBaseUrl = process.env.CANDIDATE_PORTAL_URL || process.env.FRONTEND_CANDIDATE_URL || 'https://niva.greatcampus.in';

    const candidateList = assessment.candidates.map((cand) => {
      if (cand.emailStatus === 'SENT' || cand.emailStatus === 'DELIVERED') invitedCount++;
      const latestAttempt = cand.attempts[0] || null;
      let status = cand.status;

      if (latestAttempt) {
        startedCount++;
        if (latestAttempt.status === 'COMPLETED') {
          completedCount++;
          if (latestAttempt.isPassed || latestAttempt.percentage >= (latestAttempt.passingPercentageSnapshot || assessment.passingPercentage || 50)) {
            qualifiedCount++;
          } else {
            notQualifiedCount++;
          }
        } else if (latestAttempt.status === 'LOCKED') {
          lockedCount++;
          status = 'LOCKED';
        } else if (latestAttempt.status === 'IN_PROGRESS') {
          inProgressCount++;
        }
      }

      return {
        id: cand.id,
        name: cand.name,
        email: cand.email,
        phone: cand.phone,
        applicationId: cand.applicationId,
        referenceId: cand.referenceId,
        secureToken: cand.secureToken,
        emailStatus: cand.emailStatus || 'PENDING',
        emailSentAt: cand.emailSentAt,
        status,
        vendorId: cand.vendorId || null,
        vendor: cand.vendor || null,
        createdAt: cand.createdAt,
        uniqueExamLink: `${frontendBaseUrl}/${assessment.slug}?token=${cand.secureToken || cand.id}`,
        attempt: latestAttempt ? {
          id: latestAttempt.id,
          status: latestAttempt.status,
          score: latestAttempt.score,
          totalPossibleScore: latestAttempt.totalPossibleScore || 60,
          percentage: latestAttempt.percentage,
          isPassed: latestAttempt.isPassed,
          warningCount: latestAttempt.warningCount,
          maxProctorWarnings: assessment.maxProctorWarnings || latestAttempt.maxProctorWarningsSnapshot || MAX_PROCTOR_WARNINGS,
          startedAt: latestAttempt.startedAt,
          submittedAt: latestAttempt.submittedAt,
        } : null,
      };
    });

    const notStartedCount = Math.max(0, totalCandidates - startedCount);

    return {
      success: true,
      assessment: {
        id: assessment.id,
        name: assessment.name,
        slug: assessment.slug,
        description: assessment.description,
        status: assessment.status,
        durationMins: assessment.durationMins || EXAM_DURATION_MINS,
        passingPercentage: assessment.passingPercentage,
        maxProctorWarnings: assessment.maxProctorWarnings,
        activeFrom: assessment.activeFrom,
        activeUntil: assessment.activeUntil,
        candidateLink: `${frontendBaseUrl}/${assessment.slug}`,
      },
      stats: {
        totalCandidates,
        invitedCount,
        notStartedCount,
        startedCount,
        inProgressCount,
        completedCount,
        lockedCount,
        qualifiedCount,
        notQualifiedCount,
      },
      candidates: candidateList,
    };
  }

  // ─── ASSIGN / REASSIGN CANDIDATE TO VENDOR ────────────────────────────────
  async assignCandidateVendor(candidateId: string, vendorId: string | null) {
    const candidate = await this.prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new NotFoundException('Candidate not found.');

    if (vendorId) {
      const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
      if (!vendor) throw new NotFoundException('Target vendor not found.');
    }

    const updated = await this.prisma.candidate.update({
      where: { id: candidateId },
      data: { vendorId: vendorId || null },
      include: {
        vendor: { select: { id: true, name: true, vendorCode: true } },
      },
    });

    return {
      success: true,
      message: vendorId ? `Candidate assigned to vendor successfully.` : `Candidate moved to Direct Admin.`,
      candidate: updated,
    };
  }

  async bulkAssignCandidateVendor(candidateIds: string[], vendorId: string | null) {
    if (!candidateIds || candidateIds.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    if (vendorId) {
      const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
      if (!vendor) throw new NotFoundException('Target vendor not found.');
    }

    const result = await this.prisma.candidate.updateMany({
      where: { id: { in: candidateIds } },
      data: { vendorId: vendorId || null },
    });

    return {
      success: true,
      message: `${result.count} candidate(s) successfully assigned.`,
      updatedCount: result.count,
    };
  }

  // ─── CANDIDATE BULK EXCEL UPLOAD & TOKEN GENERATION ────────────────────────
  async uploadCandidatesExcel(data: {
    assessmentId: string;
    candidates: Array<{ name: string; email: string; phone?: string; applicationId?: string; vendorId?: string }>;
    vendorId?: string;
  }) {
    const { assessmentId, candidates, vendorId } = data;
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) throw new NotFoundException('Assessment not found.');

    const createdCandidates: any[] = [];
    const duplicateList: any[] = [];
    const errors: any[] = [];

    const frontendBaseUrl = process.env.CANDIDATE_PORTAL_URL || process.env.FRONTEND_CANDIDATE_URL || 'https://niva.greatcampus.in';

    for (const raw of candidates) {
      const name = (raw.name || '').trim();
      const email = (raw.email || '').trim().toLowerCase();
      const phone = (raw.phone || '').toString().trim();
      const applicationId = (raw.applicationId || '').trim();
      const candidateVendorId = vendorId || raw.vendorId || null;

      if (!email || !name) {
        errors.push({ email, name, error: 'Missing candidate name or email.' });
        continue;
      }

      const uniqueSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const referenceId = applicationId
        ? `REF-${applicationId.toUpperCase()}-${uniqueSuffix}`
        : `REF-${Date.now().toString().slice(-6)}-${uniqueSuffix}`;
      const secureToken = crypto.randomUUID ? crypto.randomUUID() : `tok_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      try {
        // Check if candidate with this email is already assigned to this assessment
        const existing = await this.prisma.candidate.findFirst({
          where: { assessmentId, email },
        });

        if (existing) {
          // Update candidate details if needed
          const updated = await this.prisma.candidate.update({
            where: { id: existing.id },
            data: {
              name,
              ...(phone && { phone }),
              ...(applicationId && { applicationId }),
              ...(candidateVendorId && { vendorId: candidateVendorId }),
              ...(!existing.secureToken && { secureToken }),
            },
          });

          duplicateList.push({ email, name, candidateId: existing.id });
          createdCandidates.push({
            id: updated.id,
            name: updated.name,
            email: updated.email,
            phone: updated.phone,
            applicationId: updated.applicationId,
            referenceId: updated.referenceId,
            secureToken: updated.secureToken,
            uniqueExamLink: `${frontendBaseUrl}/${assessment.slug}?token=${updated.secureToken || updated.id}`,
          });
          continue;
        }

        const created = await this.prisma.candidate.create({
          data: {
            assessmentId,
            name,
            email,
            phone: phone || '0000000000',
            applicationId: applicationId || null,
            crmCandidateId: applicationId ? `CRM-${applicationId}` : null,
            referenceId,
            secureToken,
            status: 'REGISTERED',
            emailStatus: 'PENDING',
            vendorId: candidateVendorId,
          },
        });

        createdCandidates.push({
          id: created.id,
          name: created.name,
          email: created.email,
          phone: created.phone,
          applicationId: created.applicationId,
          referenceId: created.referenceId,
          secureToken: created.secureToken,
          uniqueExamLink: `${frontendBaseUrl}/${assessment.slug}?token=${created.secureToken}`,
        });
      } catch (err: any) {
        this.logger.error(`[Upload Candidate Error] ${email}: ${err.message}`);
        errors.push({ email, name, error: `Failed to save candidate: ${err.message}` });
      }
    }

    // Auto-dispatch invitation emails asynchronously in background
    if (createdCandidates.length > 0) {
      const candidateIds = createdCandidates.map((c) => c.id);
      this.logger.log(`[Auto Email Dispatch] Triggering auto email invitations for ${candidateIds.length} candidate(s)...`);

      this.emailService
        .sendBulkInvitations({
          assessmentId,
          candidateIds,
        })
        .then((res) => {
          this.logger.log(`[Auto Email Dispatch Complete] Sent: ${res.sent}, Failed: ${res.failed}`);
        })
        .catch((err) => {
          this.logger.error(`[Auto Email Dispatch Error] ${err.message}`);
        });
    }

    const message = createdCandidates.length > 0
      ? `Successfully assigned ${createdCandidates.length} candidate(s) to '${assessment.name}'. Invitation emails are being dispatched automatically.`
      : `No new candidates assigned. Please check the uploaded details.`;

    return {
      success: createdCandidates.length > 0,
      message,
      createdCount: createdCandidates.length,
      duplicateCount: duplicateList.length,
      createdCandidates,
      duplicateList,
      errors,
    };
  }

  // ─── VERIFY CANDIDATE SECURE TOKEN & REGISTERED EMAIL ─────────────────────
  async verifyCandidateToken(token: string, inputEmail?: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: {
        OR: [
          { secureToken: token },
          { id: token },
          { referenceId: token },
        ],
      },
      include: {
        assessment: true,
        attempts: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!candidate) {
      throw new NotFoundException('Invalid assignment token. No candidate record found.');
    }

    const assessment = candidate.assessment;
    const now = new Date();

    if (assessment.activeFrom && now < new Date(assessment.activeFrom)) {
      return {
        success: false,
        code: 'UPCOMING',
        message: `This assessment session has not started yet. It will become active on ${new Date(assessment.activeFrom).toLocaleString()}.`,
        assessmentName: assessment.name,
      };
    }

    if (assessment.activeUntil && now > new Date(assessment.activeUntil)) {
      return {
        success: false,
        code: 'EXPIRED',
        message: `This assessment link has expired on ${new Date(assessment.activeUntil).toLocaleString()}. Please contact your HR Administrator.`,
        assessmentName: assessment.name,
      };
    }

    if (inputEmail) {
      const cleanInput = inputEmail.trim().toLowerCase();
      const registered = candidate.email.trim().toLowerCase();
      if (cleanInput !== registered) {
        return {
          success: false,
          code: 'EMAIL_MISMATCH',
          message: `The entered email (${inputEmail}) does not match the assigned registered email. Please enter the exact email from your invitation.`,
          registeredEmailHint: `${candidate.email.substring(0, 3)}***@${candidate.email.split('@')[1]}`,
        };
      }
    }

    const latestAttempt = candidate.attempts[0] || null;
    const isCompleted = latestAttempt && latestAttempt.status === 'COMPLETED';

    return {
      success: true,
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        applicationId: candidate.applicationId || candidate.referenceId,
        referenceId: candidate.referenceId,
        secureToken: candidate.secureToken,
      },
      assessment: {
        id: assessment.id,
        name: assessment.name,
        slug: assessment.slug,
        description: assessment.description,
        durationMins: assessment.durationMins || EXAM_DURATION_MINS,
        totalQuestions: TOTAL_QUESTIONS,
        passingPercentage: assessment.passingPercentage,
        maxProctorWarnings: assessment.maxProctorWarnings,
      },
      attemptStatus: latestAttempt ? latestAttempt.status : 'NOT_STARTED',
      isCompleted,
    };
  }

  // ─── 5-SHEET COMPREHENSIVE EXCEL EXPORT ENGINE ────────────────────────────
  async exportComprehensiveExcel(assessmentId?: string): Promise<ExcelJS.Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GreatCampus Assessment System — Niva Bupa';
    workbook.created = new Date();

    const whereClause: any = { isDeleted: false };
    if (assessmentId) whereClause.assessmentId = assessmentId;

    const candidates = await this.prisma.candidate.findMany({
      where: whereClause,
      include: {
        assessment: true,
        attempts: {
          orderBy: { startedAt: 'desc' },
          include: {
            submissions: { include: { question: true } },
            proctoringLogs: true,
            adminActions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const targetAssessment = assessmentId ? await this.prisma.assessment.findUnique({ where: { id: assessmentId } }) : null;

    // Header styling helpers
    const primaryHeaderFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF003F72' },
    };
    const subHeaderFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00AEEF' },
    };
    const headerFont: Partial<ExcelJS.Font> = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

    // ──────────────────────────────────────────────────────────────────────────
    // SHEET 1: Assessment Summary & Statistics
    // ──────────────────────────────────────────────────────────────────────────
    const sheet1 = workbook.addWorksheet('Assessment Summary');
    sheet1.columns = [{ width: 25 }, { width: 35 }, { width: 18 }, { width: 18 }];

    sheet1.addRow(['NIVA BUPA HEALTH INSURANCE — ASSESSMENT SUMMARY REPORT']);
    sheet1.mergeCells('A1:D1');
    const titleCell1 = sheet1.getCell('A1');
    titleCell1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell1.fill = primaryHeaderFill;
    titleCell1.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet1.getRow(1).height = 35;

    sheet1.addRow([]);
    sheet1.addRow(['Assessment Title', targetAssessment ? targetAssessment.name : 'All Active Assessment Batches']);
    sheet1.addRow(['Generated Date', new Date().toLocaleString()]);
    sheet1.addRow(['Duration', `${targetAssessment?.durationMins || 45} Minutes (60 Questions)`]);

    const totalCands = candidates.length;
    let completedCands = 0;
    let inProgressCands = 0;
    let notStartedCands = 0;
    let lockedCands = 0;

    candidates.forEach((c) => {
      const att = c.attempts[0];
      if (!att) notStartedCands++;
      else if (att.status === 'COMPLETED') completedCands++;
      else if (att.status === 'LOCKED') lockedCands++;
      else if (att.status === 'IN_PROGRESS') inProgressCands++;
    });

    sheet1.addRow([]);
    const statHeader = sheet1.addRow(['Metric Description', 'Candidate Count', 'Percentage Ratio']);
    statHeader.font = headerFont;
    statHeader.eachCell((cell) => { cell.fill = subHeaderFill; cell.alignment = { vertical: 'middle', horizontal: 'center' }; });

    sheet1.addRow(['Total Assigned Candidates', totalCands, '100%']);
    sheet1.addRow(['Completed Exams', completedCands, totalCands > 0 ? `${Math.round((completedCands / totalCands) * 100)}%` : '0%']);
    sheet1.addRow(['In Progress / Active', inProgressCands, totalCands > 0 ? `${Math.round((inProgressCands / totalCands) * 100)}%` : '0%']);
    sheet1.addRow(['Locked / Flagged Sessions', lockedCands, totalCands > 0 ? `${Math.round((lockedCands / totalCands) * 100)}%` : '0%']);
    sheet1.addRow(['Not Started', notStartedCands, totalCands > 0 ? `${Math.round((notStartedCands / totalCands) * 100)}%` : '0%']);

    // ──────────────────────────────────────────────────────────────────────────
    // SHEET 2: Candidate Results
    // ──────────────────────────────────────────────────────────────────────────
    const sheet2 = workbook.addWorksheet('Candidate Results');
    sheet2.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Candidate Name', key: 'name', width: 24 },
      { header: 'Email Address', key: 'email', width: 28 },
      { header: 'Phone Number', key: 'phone', width: 16 },
      { header: 'Application ID', key: 'appId', width: 18 },
      { header: 'Assessment', key: 'assessment', width: 30 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Score (Obtained/60)', key: 'score', width: 20 },
      { header: 'Percentage', key: 'pct', width: 14 },
      { header: 'Start Time', key: 'startedAt', width: 20 },
      { header: 'End Time', key: 'submittedAt', width: 20 },
      { header: 'Time Taken', key: 'timeTaken', width: 16 },
    ];

    sheet2.getRow(1).font = headerFont;
    sheet2.getRow(1).height = 28;
    sheet2.getRow(1).eachCell((cell) => { cell.fill = primaryHeaderFill; cell.alignment = { vertical: 'middle', horizontal: 'center' }; });

    candidates.forEach((c, idx) => {
      const att = c.attempts[0];
      let timeTaken = '—';
      if (att && att.startedAt) {
        const start = new Date(att.startedAt).getTime();
        const end = att.submittedAt ? new Date(att.submittedAt).getTime() : Date.now();
        const sec = Math.max(0, Math.floor((end - start) / 1000));
        timeTaken = `${Math.floor(sec / 60)}m ${sec % 60}s`;
      }

      sheet2.addRow({
        sno: idx + 1,
        name: c.name,
        email: c.email,
        phone: c.phone,
        appId: c.applicationId || c.referenceId,
        assessment: c.assessment?.name || 'Niva Bupa Assessment',
        status: att ? att.status : c.status,
        score: att ? `${att.score} / ${att.totalPossibleScore || 60}` : '—',
        pct: att ? `${att.percentage}%` : '—',
        startedAt: att?.startedAt ? new Date(att.startedAt).toLocaleString() : '—',
        submittedAt: att?.submittedAt ? new Date(att.submittedAt).toLocaleString() : '—',
        timeTaken,
      });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // SHEET 3: 6-Section Performance Matrix
    // ──────────────────────────────────────────────────────────────────────────
    const sheet3 = workbook.addWorksheet('Section Scores');
    sheet3.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Candidate Name', key: 'name', width: 24 },
      { header: 'App ID', key: 'appId', width: 16 },
      { header: 'Q1-10: Communication (10)', key: 'sec1', width: 24 },
      { header: 'Q11-20: Adv English (10)', key: 'sec2', width: 24 },
      { header: 'Q21-30: Mental Ability (10)', key: 'sec3', width: 24 },
      { header: 'Q31-40: Numerical (10)', key: 'sec4', width: 24 },
      { header: 'Q41-50: Banking (10)', key: 'sec5', width: 24 },
      { header: 'Q51-60: Sales & Situation (10)', key: 'sec6', width: 26 },
      { header: 'Total Score (60)', key: 'total', width: 16 },
      { header: 'Overall %', key: 'overall', width: 14 },
    ];

    sheet3.getRow(1).font = headerFont;
    sheet3.getRow(1).height = 28;
    sheet3.getRow(1).eachCell((cell) => { cell.fill = primaryHeaderFill; cell.alignment = { vertical: 'middle', horizontal: 'center' }; });

    candidates.forEach((c, idx) => {
      const att = c.attempts[0];
      const secScores = [0, 0, 0, 0, 0, 0];

      if (att && att.submissions) {
        const sortedSub = att.submissions.sort((a, b) => {
          const qA = parseInt(a.questionId.replace(/\D/g, '')) || 0;
          const qB = parseInt(b.questionId.replace(/\D/g, '')) || 0;
          return qA - qB;
        });

        sortedSub.forEach((sub, subIdx) => {
          const secIdx = Math.min(5, Math.floor(subIdx / 10));
          if (sub.isCorrect) secScores[secIdx]++;
        });
      }

      sheet3.addRow({
        sno: idx + 1,
        name: c.name,
        appId: c.applicationId || c.referenceId,
        sec1: att ? `${secScores[0]}/10 (${secScores[0] * 10}%)` : '—',
        sec2: att ? `${secScores[1]}/10 (${secScores[1] * 10}%)` : '—',
        sec3: att ? `${secScores[2]}/10 (${secScores[2] * 10}%)` : '—',
        sec4: att ? `${secScores[3]}/10 (${secScores[3] * 10}%)` : '—',
        sec5: att ? `${secScores[4]}/10 (${secScores[4] * 10}%)` : '—',
        sec6: att ? `${secScores[5]}/10 (${secScores[5] * 10}%)` : '—',
        total: att ? `${att.score}/60` : '—',
        overall: att ? `${att.percentage}%` : '—',
      });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // SHEET 4: Security & Proctoring Violations Log
    // ──────────────────────────────────────────────────────────────────────────
    const sheet4 = workbook.addWorksheet('Security & Proctoring');
    sheet4.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Candidate Name', key: 'name', width: 24 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Warnings Count', key: 'warnings', width: 16 },
      { header: 'Tab Switches', key: 'tabSwitch', width: 14 },
      { header: 'Fullscreen Exits', key: 'fsExit', width: 16 },
      { header: 'Face Missing Events', key: 'faceMissing', width: 20 },
      { header: 'Lock Status', key: 'locked', width: 16 },
      { header: 'Last Lock Reason', key: 'lockReason', width: 32 },
      { header: 'Admin Unlock Audit', key: 'unlockAudit', width: 30 },
    ];

    sheet4.getRow(1).font = headerFont;
    sheet4.getRow(1).height = 28;
    sheet4.getRow(1).eachCell((cell) => { cell.fill = primaryHeaderFill; cell.alignment = { vertical: 'middle', horizontal: 'center' }; });

    candidates.forEach((c, idx) => {
      const att = c.attempts[0];
      let tabSwitches = 0;
      let fsExits = 0;
      let faceMissing = 0;

      if (att && att.proctoringLogs) {
        att.proctoringLogs.forEach((p) => {
          if (p.eventType === 'TAB_SWITCH') tabSwitches++;
          if (p.eventType === 'FULLSCREEN_EXIT') fsExits++;
          if (p.eventType === 'FACE_NOT_DETECTED' || p.eventType === 'MULTIPLE_FACES') faceMissing++;
        });
      }

      const unlockAudit = att?.unlockedByAdminName ? `Unlocked by ${att.unlockedByAdminName} at ${new Date(att.unlockedAt!).toLocaleTimeString()}` : '—';

      sheet4.addRow({
        sno: idx + 1,
        name: c.name,
        email: c.email,
        warnings: att ? `${att.warningCount}/${att.maxProctorWarningsSnapshot || MAX_PROCTOR_WARNINGS}` : `0/${MAX_PROCTOR_WARNINGS}`,
        tabSwitch: tabSwitches,
        fsExit: fsExits,
        faceMissing,
        locked: att?.status === 'LOCKED' ? 'YES (LOCKED)' : 'NO',
        lockReason: att?.lockReason || '—',
        unlockAudit,
      });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // SHEET 5: Detailed Competency Analysis
    // ──────────────────────────────────────────────────────────────────────────
    const sheet5 = workbook.addWorksheet('Competency Analysis');
    sheet5.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Candidate Name', key: 'name', width: 24 },
      { header: 'App ID', key: 'appId', width: 16 },
      { header: 'Cognitive Reasoning', key: 'cognitive', width: 22 },
      { header: 'Banking & Financial Acumen', key: 'banking', width: 25 },
      { header: 'Sales & Customer Orientation', key: 'sales', width: 25 },
      { header: 'Identified Core Strengths', key: 'strengths', width: 34 },
      { header: 'Areas of Development', key: 'development', width: 34 },
      { header: 'Hiring Recommendation', key: 'recommendation', width: 24 },
    ];

    sheet5.getRow(1).font = headerFont;
    sheet5.getRow(1).height = 28;
    sheet5.getRow(1).eachCell((cell) => { cell.fill = primaryHeaderFill; cell.alignment = { vertical: 'middle', horizontal: 'center' }; });

    candidates.forEach((c, idx) => {
      const att = c.attempts[0];
      let cognitivePct = 0;
      let bankingPct = 0;
      let salesPct = 0;
      let strengths = 'Assessment pending';
      let development = 'Assessment pending';
      let recommendation = 'Pending';

      if (att && att.submissions && att.submissions.length > 0) {
        const secScores = [0, 0, 0, 0, 0, 0];
        const sortedSub = att.submissions.sort((a, b) => {
          const qA = parseInt(a.questionId.replace(/\D/g, '')) || 0;
          const qB = parseInt(b.questionId.replace(/\D/g, '')) || 0;
          return qA - qB;
        });

        sortedSub.forEach((sub, subIdx) => {
          const secIdx = Math.min(5, Math.floor(subIdx / 10));
          if (sub.isCorrect) secScores[secIdx]++;
        });

        cognitivePct = Math.round(((secScores[2] + secScores[3]) / 20) * 100);
        bankingPct = Math.round((secScores[4] / 10) * 100);
        salesPct = Math.round(((secScores[0] + secScores[5]) / 20) * 100);

        const strengthList: string[] = [];
        const devList: string[] = [];

        if (salesPct >= 60) strengthList.push('High Customer & Sales Orientation');
        else devList.push('Sales Pitch & Objection Handling');

        if (bankingPct >= 60) strengthList.push('Solid Insurance & Banking Knowledge');
        else devList.push('Financial Product Regulations');

        if (cognitivePct >= 60) strengthList.push('Strong Analytical & Numerical Ability');
        else devList.push('Data Interpretation Speed');

        strengths = strengthList.join(', ') || 'General Aptitude';
        development = devList.join(', ') || 'No critical weaknesses';

        recommendation = (att && att.percentage >= 60) ? 'Strongly Recommended' : 'Standard Evaluation';
      }

      sheet5.addRow({
        sno: idx + 1,
        name: c.name,
        appId: c.applicationId || c.referenceId,
        cognitive: att ? `${cognitivePct}%` : '—',
        banking: att ? `${bankingPct}%` : '—',
        sales: att ? `${salesPct}%` : '—',
        strengths,
        development,
        recommendation: att ? recommendation : 'Pending',
      });
    });

    return workbook.xlsx.writeBuffer();
  }

  // ─── SINGLE CANDIDATE INDIVIDUAL EXCEL SCORECARD EXPORT ───────────────────
  // ─── SINGLE CANDIDATE INDIVIDUAL EXCEL SCORECARD EXPORT ───────────────────
  async exportSingleCandidateExcel(candidateId: string): Promise<{ buffer: ExcelJS.Buffer; candidateName: string; applicationId: string }> {
    const candidate: any = await (this.prisma.candidate as any).findUnique({
      where: { id: candidateId },
      include: {
        assessment: true,
        attempts: {
          orderBy: { startedAt: 'desc' },
          include: {
            attemptQuestions: {
              orderBy: { questionOrder: 'asc' },
              include: { question: true },
            },
            submissions: { include: { question: true } },
            proctoringLogs: { orderBy: { timestamp: 'asc' } },
            adminActions: true,
            screenshots: true,
          },
        },
      },
    });

    if (!candidate) throw new NotFoundException(`Candidate '${candidateId}' not found.`);

    const latestAttempt = candidate.attempts ? candidate.attempts[0] : null;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Niva Bupa Health Insurance Assessment System';
    workbook.created = new Date();

    const primaryFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003F72' } };
    const cyanFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00AEEF' } };
    const successFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
    const dangerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
    const headerFont: Partial<ExcelJS.Font> = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

    // ──────────────────────────────────────────────────────────────────────────
    // SHEET 1: Executive Candidate Scorecard
    // ──────────────────────────────────────────────────────────────────────────
    const sheet1 = workbook.addWorksheet('Executive Scorecard');
    sheet1.columns = [{ width: 28 }, { width: 42 }, { width: 20 }, { width: 22 }];

    sheet1.addRow(['NIVA BUPA HEALTH INSURANCE — INDIVIDUAL CANDIDATE SCORECARD']);
    sheet1.mergeCells('A1:D1');
    const title1 = sheet1.getCell('A1');
    title1.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
    title1.fill = primaryFill;
    title1.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet1.getRow(1).height = 36;

    sheet1.addRow([]);
    sheet1.addRow(['Candidate Full Name', candidate.name]);
    sheet1.addRow(['Application / Reference ID', candidate.applicationId || candidate.referenceId]);
    sheet1.addRow(['Registered Email', candidate.email]);
    sheet1.addRow(['Contact Phone Number', candidate.phone || '—']);
    sheet1.addRow(['Assessment Title', candidate.assessment?.name || 'ARM Banca & Agency Assessment']);
    sheet1.addRow(['Report Generation Date', new Date().toLocaleString()]);
    sheet1.addRow([]);

    let scoreMarks = latestAttempt ? latestAttempt.score : 0;
    let totalMarks = latestAttempt ? (latestAttempt.totalPossibleScore || 60) : 60;
    let scorePct = latestAttempt ? latestAttempt.percentage : 0;
    let examStatus = latestAttempt ? (latestAttempt.status === 'LOCKED' || candidate.status === 'LOCKED' ? 'LOCKED' : latestAttempt.status) : 'NOT STARTED';

    let durationSec = latestAttempt?.totalTimeSpentSec || 0;
    if (!durationSec && latestAttempt?.startedAt) {
      const endTime = latestAttempt.submittedAt
        ? new Date(latestAttempt.submittedAt).getTime()
        : latestAttempt.lockedAt
          ? new Date(latestAttempt.lockedAt).getTime()
          : Date.now();
      durationSec = Math.max(0, Math.floor((endTime - new Date(latestAttempt.startedAt).getTime()) / 1000));
    }
    const durationFormatted = `${Math.floor(durationSec / 60)} mins ${durationSec % 60} secs`;

    const summaryHeader = sheet1.addRow(['Evaluation Metric', 'Assessment Result', 'Details / Parameters']);
    summaryHeader.font = headerFont;
    summaryHeader.eachCell((c) => { c.fill = cyanFill; c.alignment = { vertical: 'middle', horizontal: 'center' }; });

    sheet1.addRow(['Exam Status', examStatus, examStatus === 'COMPLETED' ? 'Assessment Evaluated' : 'In Progress / Pending']);
    sheet1.addRow(['Total Score Obtained', `${scoreMarks} / ${totalMarks} Marks`, `60 Questions Evaluated`]);
    sheet1.addRow(['Overall Percentage', `${scorePct}%`, 'Final Test Percentage']);
    sheet1.addRow(['Time Spent in Exam', durationFormatted, `Allowed Duration: ${candidate.assessment?.durationMins || 45} Mins`]);
    sheet1.addRow(['Proctoring Violations Count', `${latestAttempt?.warningCount || 0} Warnings`, latestAttempt?.warningCount > 0 ? 'Recorded Incidents' : 'Clean Session']);
    sheet1.addRow(['Session Integrity Score', `${Math.max(0, 100 - (latestAttempt?.warningCount || 0) * 15)}%`, 'Proctor Confidence']);

    // ──────────────────────────────────────────────────────────────────────────
    // SHEET 2: 6-Section Performance Breakdown
    // ──────────────────────────────────────────────────────────────────────────
    const sheet2 = workbook.addWorksheet('Section Breakdown');
    sheet2.columns = [
      { width: 12, header: 'Section #' },
      { width: 38, header: 'Section Title' },
      { width: 16, header: 'Questions' },
      { width: 14, header: 'Total Marks' },
      { width: 16, header: 'Marks Scored' },
      { width: 16, header: 'Percentage' },
      { width: 24, header: 'Competency Level' },
    ];

    sheet2.addRow(['6-SECTION DIAGNOSTIC PERFORMANCE BREAKDOWN']);
    sheet2.mergeCells('A1:G1');
    const title2 = sheet2.getCell('A1');
    title2.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    title2.fill = primaryFill;
    title2.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet2.getRow(1).height = 32;

    sheet2.addRow([]);
    const secHeaderRow = sheet2.addRow(['Sec #', 'Competency Section Name', 'Questions', 'Max Marks', 'Scored', 'Percentage', 'Proficiency Rating']);
    secHeaderRow.font = headerFont;
    secHeaderRow.eachCell((c) => { c.fill = cyanFill; c.alignment = { vertical: 'middle', horizontal: 'center' }; });

    const officialSecs = [
      { order: 1, name: 'Communication & Customer Handling', range: 'Q1–Q10', max: 10, scored: 0 },
      { order: 2, name: 'Advanced English & Comprehension', range: 'Q11–Q20', max: 10, scored: 0 },
      { order: 3, name: 'Mental Ability & Reasoning', range: 'Q21–Q30', max: 10, scored: 0 },
      { order: 4, name: 'Numerical & Mathematical Reasoning', range: 'Q31–Q40', max: 10, scored: 0 },
      { order: 5, name: 'Banking & Financial Awareness', range: 'Q41–Q50', max: 10, scored: 0 },
      { order: 6, name: 'Sales Orientation & Situational Judgement', range: 'Q51–Q60', max: 10, scored: 0 },
    ];

    // Load full 60 questions list sequentially
    let questionsList: any[] = [];
    if (latestAttempt?.attemptQuestions && latestAttempt.attemptQuestions.length > 0) {
      questionsList = latestAttempt.attemptQuestions
        .slice()
        .sort((a: any, b: any) => (a.questionOrder || 0) - (b.questionOrder || 0))
        .map((aq: any) => ({
          questionOrder: aq.questionOrder,
          questionId: aq.questionId || aq.question?.id,
          question: aq.question,
          marks: aq.marks || 1,
        }));
    } else {
      const allQuestions = await this.prisma.question.findMany({
        where: { status: 'ACTIVE' },
        orderBy: [{ sectionOrder: 'asc' }, { createdAt: 'asc' }],
      });
      questionsList = allQuestions.slice(0, 60).map((q: any, i: number) => ({
        questionOrder: i + 1,
        questionId: q.id,
        question: q,
        marks: q.marks || 1,
      }));
    }

    const rawSubmissions = latestAttempt?.submissions || [];

    // Calculate section scores from exact 60 sequential questions
    questionsList.slice(0, 60).forEach((item: any, idx: number) => {
      const q = item.question;
      const sub = rawSubmissions.find((s: any) => s.questionId === item.questionId || s.question?.id === item.questionId);
      const isCorrect = !!(sub && sub.isCorrect);

      const secIdx = Math.min(5, Math.floor(idx / 10));
      if (isCorrect) officialSecs[secIdx].scored++;
    });

    officialSecs.forEach((sec) => {
      const pct = Math.round((sec.scored / sec.max) * 100);
      let rating = 'Needs Development';
      if (pct >= 80) rating = 'Mastery / Advanced';
      else if (pct >= 60) rating = 'Competent / Proficient';
      else if (pct >= 40) rating = 'Basic / Developing';

      const row = sheet2.addRow([
        `Section ${sec.order}`,
        sec.name,
        sec.range,
        sec.max,
        sec.scored,
        `${pct}%`,
        rating,
      ]);
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'center' };
      row.getCell(7).alignment = { horizontal: 'center' };
    });

    // ──────────────────────────────────────────────────────────────────────────
    // SHEET 3: Itemized Response Audit (All 60 Questions)
    // ──────────────────────────────────────────────────────────────────────────
    const sheet3 = workbook.addWorksheet('60 Questions Audit');
    sheet3.columns = [
      { width: 8, header: 'Q#' },
      { width: 34, header: 'Section' },
      { width: 55, header: 'Question Content' },
      { width: 18, header: "Candidate's Choice" },
      { width: 18, header: 'Correct Answer' },
      { width: 14, header: 'Result' },
      { width: 12, header: 'Marks' },
    ];

    sheet3.addRow(['ITEMIZED 60-QUESTION AUDIT & CANDIDATE RESPONSES']);
    sheet3.mergeCells('A1:G1');
    const title3 = sheet3.getCell('A1');
    title3.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    title3.fill = primaryFill;
    title3.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet3.getRow(1).height = 32;

    sheet3.addRow([]);
    const qHeaderRow = sheet3.addRow(['Q#', 'Section Name', 'Question Text', "Candidate's Option", 'Correct Answer', 'Verification', 'Marks']);
    qHeaderRow.font = headerFont;
    qHeaderRow.eachCell((c) => { c.fill = cyanFill; c.alignment = { vertical: 'middle', horizontal: 'center' }; });

    questionsList.slice(0, 60).forEach((item: any, idx: number) => {
      const qNum = idx + 1;
      const secIdx = Math.min(5, Math.floor(idx / 10));
      const secName = officialSecs[secIdx].name;
      const q = item.question;
      const sub = rawSubmissions.find((s: any) => s.questionId === item.questionId || s.question?.id === item.questionId);

      const isAttempted = !!(sub && sub.selectedOption);
      const isCorrect = isAttempted && !!sub.isCorrect;
      const candidateOption = isAttempted ? sub.selectedOption : 'Not Attempted';

      const row = sheet3.addRow([
        qNum,
        secName,
        q?.question || 'Question Text',
        candidateOption,
        q?.correctAnswer || 'Option A',
        isCorrect ? 'CORRECT' : 'INCORRECT',
        isCorrect ? 1 : 0,
      ]);

      const verCell = row.getCell(6);
      verCell.font = { bold: true, color: { argb: isCorrect ? 'FF059669' : 'FFDC2626' } };
      verCell.alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(7).alignment = { horizontal: 'center' };
    });

    // ──────────────────────────────────────────────────────────────────────────
    // SHEET 4: Proctoring & Security Audit
    // ──────────────────────────────────────────────────────────────────────────
    const sheet4 = workbook.addWorksheet('Proctoring Audit');
    sheet4.columns = [
      { width: 10, header: 'Event #' },
      { width: 26, header: 'Timestamp' },
      { width: 28, header: 'Violation Type' },
      { width: 46, header: 'Event Details' },
      { width: 18, header: 'Severity' },
    ];

    sheet4.addRow(['PROCTORING VIOLATION TIMELINE & AUDIT LOGS']);
    sheet4.mergeCells('A1:E1');
    const title4 = sheet4.getCell('A1');
    title4.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    title4.fill = primaryFill;
    title4.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet4.getRow(1).height = 32;

    sheet4.addRow([]);
    const procHeaderRow = sheet4.addRow(['Event #', 'Event Timestamp', 'Security Violation Type', 'Event Details', 'Severity Level']);
    procHeaderRow.font = headerFont;
    procHeaderRow.eachCell((c) => { c.fill = cyanFill; c.alignment = { vertical: 'middle', horizontal: 'center' }; });

    const procLogs = latestAttempt?.proctoringLogs || [];
    if (procLogs.length === 0) {
      sheet4.addRow([1, new Date().toLocaleString(), 'NO_VIOLATIONS', 'Candidate completed the assessment with zero proctoring infractions.', 'CLEAN']);
    } else {
      procLogs.forEach((p: any, pIdx: number) => {
        sheet4.addRow([
          pIdx + 1,
          new Date(p.timestamp).toLocaleString(),
          p.eventType || 'PROCTOR_WARNING',
          p.details || 'Proctoring system alert triggered during session.',
          'HIGH RISK',
        ]);
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer,
      candidateName: candidate.name,
      applicationId: candidate.applicationId || candidate.referenceId || candidate.id,
    };
  }
}

