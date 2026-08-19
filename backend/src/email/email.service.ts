import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private prisma: PrismaService) {}

  async getSmtpConfig() {
    let config = await this.prisma.smtpConfig.findFirst();
    if (!config) {
      config = await this.prisma.smtpConfig.create({
        data: {
          tenantId: 'default-tenant',
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: Number(process.env.SMTP_PORT) || 587,
          username: process.env.SMTP_USER || '',
          password: process.env.SMTP_PASSWORD || '',
          encryption: process.env.SMTP_SECURE === 'true' ? 'SSL' : 'TLS',
          fromName: process.env.SMTP_FROM_NAME || 'CCE Programme Team',
          fromEmail: process.env.SMTP_FROM_EMAIL || 'recruitment@greatcampus.in',
        },
      });
    } else if (!config.fromName || config.fromName.toLowerCase().includes('niva') || config.fromName.toLowerCase().includes('bupa')) {
      config = await this.prisma.smtpConfig.update({
        where: { id: config.id },
        data: { fromName: 'CCE Programme Team' },
      });
    }
    return config;
  }

  async saveSmtpConfig(data: {
    host: string;
    port: number;
    username: string;
    password?: string;
    encryption: string;
    fromName: string;
    fromEmail: string;
  }) {
    const existing = await this.getSmtpConfig();
    const updateData: any = {
      host: data.host,
      port: Number(data.port),
      username: data.username,
      encryption: data.encryption,
      fromName: data.fromName,
      fromEmail: data.fromEmail,
    };
    if (data.password && data.password.trim() !== '') {
      updateData.password = data.password;
    }

    return this.prisma.smtpConfig.update({
      where: { id: existing.id },
      data: updateData,
    });
  }

  private async createTransporter() {
    const config = await this.getSmtpConfig();
    const isSecure = config.encryption === 'SSL' || Number(config.port) === 465;

    return nodemailer.createTransport({
      host: config.host,
      port: Number(config.port),
      secure: isSecure,
      auth: config.username && config.password ? {
        user: config.username,
        pass: config.password,
      } : undefined,
      tls: {
        rejectUnauthorized: false,
      },
      pool: false,
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    } as any);
  }

  async testConnection(targetEmail?: string) {
    try {
      const config = await this.getSmtpConfig();
      if (!config.username || !config.password) {
        return {
          success: false,
          message: 'SMTP credentials missing. Please enter your SMTP Username and Password/App Password in Settings.',
        };
      }

      const transporter = await this.createTransporter();

      // Verify SMTP connection handshake
      await transporter.verify();

      // Send a test mail if targetEmail provided
      const recipient = targetEmail || config.username || config.fromEmail;
      if (recipient) {
        const domain = config.fromEmail.includes('@') ? config.fromEmail.split('@')[1] : 'greatcampus.in';
        const senderName = (!config.fromName || config.fromName.toLowerCase().includes('niva')) ? 'CCE Programme Team' : config.fromName;
        await transporter.sendMail({
          from: `"${senderName}" <${config.fromEmail}>`,
          to: recipient,
          subject: 'SMTP Connection Test — CCE Assessment Portal',
          text: `CCE Assessment Portal\n\nThis test email confirms that your authenticated SMTP mail server configuration (${config.host}:${config.port}) is working correctly!\n\nSender: ${senderName} (${config.fromEmail})\nTimestamp: ${new Date().toLocaleString()}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #003F72; margin-top: 0;">CCE Assessment System</h2>
              <p style="color: #334155; font-size: 14px; line-height: 1.6;">
                This test email confirms that your authenticated SMTP mail server configuration is active and working correctly!
              </p>
              <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #475569;">
                <strong>Host:</strong> ${config.host}<br/>
                <strong>Port:</strong> ${config.port}<br/>
                <strong>Sender:</strong> ${config.fromName} (&lt;${config.fromEmail}&gt;)<br/>
                <strong>Timestamp:</strong> ${new Date().toLocaleString()}
              </div>
            </div>
          `,
          messageId: `<cce-test-${Date.now()}@${domain}>`,
          headers: {
            'X-Mailer': 'CCE Programme Examination Notification Service',
            'Auto-Submitted': 'auto-generated',
          },
        });
      }

      return {
        success: true,
        message: `SMTP connection established successfully! Test email delivered to ${recipient}.`,
      };
    } catch (err: any) {
      this.logger.error(`SMTP Test error: ${err.message}`);
      return {
        success: false,
        message: `SMTP Connection Failed: ${err.message}. Please check your SMTP host, port, user, and App Password.`,
      };
    }
  }

  // ─── HIGH-DELIVERABILITY PLAIN TEXT TEMPLATE (ANTI-SPAM CRUCIAL) ────────────
  buildInvitationEmailText(data: {
    candidateName: string;
    assessmentName: string;
    durationMins: number;
    examUrl: string;
    applicationId?: string;
    activeUntil?: string;
  }) {
    const { candidateName, assessmentName, durationMins, examUrl, applicationId, activeUntil } = data;

    return `Dear ${candidateName},

You have been officially invited to undertake the ${assessmentName} for CCE Programme.

ASSESSMENT DETAILS:
• Assessment: ${assessmentName}
• Candidate Name: ${candidateName}
${applicationId ? `• Application ID: ${applicationId}\n` : ''}• Duration: ${durationMins} Minutes
• Question Count: 60 Questions (6 Core Sections)
${activeUntil ? `• Access Window Closes: ${new Date(activeUntil).toLocaleString()}\n` : ''}
DIRECT ACCESS LINK:
To launch your proctored assessment session, please open the following secure link:
${examUrl}

EXAMINATION GUIDELINES:
1. Complete the exam in a quiet, well-lit room.
2. Maintain your webcam enabled throughout the session.
3. Do not switch browser tabs or exit fullscreen mode.
4. All answers are saved automatically in real-time.

For any technical assistance during the assessment, please contact your recruitment coordinator.

Sincerely,
Recruitment & Talent Acquisition Team
CCE Programme Team
Website: https://greatcampus.in`;
  }

  // ─── HIGH-DELIVERABILITY BEAUTIFUL HTML TEMPLATE ───────────────────────────
  buildInvitationEmailHtml(data: {
    candidateName: string;
    assessmentName: string;
    durationMins: number;
    examUrl: string;
    applicationId?: string;
    activeUntil?: string;
  }) {
    const { candidateName, assessmentName, durationMins, examUrl, applicationId, activeUntil } = data;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Assessment Invitation — CCE Programme Team</title>
</head>
<body style="margin:0; padding:24px 12px; background-color:#F1F5F9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:18px; overflow:hidden; border:1px solid #E2E8F0; box-shadow:0 8px 30px rgba(0,63,114,0.06);">
    
    <!-- Top Brand Header -->
    <tr>
      <td style="background:linear-gradient(135deg, #003F72 0%, #002244 100%); padding:32px 28px; text-align:center; color:#ffffff;">
        <div style="display:inline-block; background:#00AEEF; color:#ffffff; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px; padding:4px 12px; border-radius:20px; margin-bottom:12px;">
          Official Assessment Invitation
        </div>
        <h1 style="margin:0; font-size:22px; font-weight:900; letter-spacing:-0.4px; color:#ffffff;">
          CCE Programme Team
        </h1>
        <p style="margin:6px 0 0; font-size:13px; color:#93C5FD; font-weight:500;">
          Capability &amp; Recruitment Assessment
        </p>
      </td>
    </tr>

    <!-- Main Content Area -->
    <tr>
      <td style="padding:32px 28px; color:#1E293B;">
        <p style="font-size:16px; font-weight:800; color:#0F172A; margin:0 0 12px;">
          Dear ${candidateName},
        </p>
        <p style="font-size:14px; line-height:1.6; color:#334155; margin:0 0 20px;">
          You have been shortlisted and scheduled to undertake the official <strong>${assessmentName}</strong>. This assessment evaluates core cognitive, customer engagement, and situational reasoning competencies.
        </p>

        <!-- Exam Details Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:14px; padding:18px; margin:0 0 24px;">
          <tr>
            <td>
              <div style="font-size:13px; font-weight:800; color:#003F72; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">
                📋 Exam Session Overview
              </div>
              
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px; color:#475569;">
                <tr>
                  <td style="padding:5px 0; font-weight:600; color:#64748B; width:140px;">Candidate Name:</td>
                  <td style="padding:5px 0; font-weight:700; color:#0F172A;">${candidateName}</td>
                </tr>
                ${applicationId ? `<tr>
                  <td style="padding:5px 0; font-weight:600; color:#64748B;">Application ID:</td>
                  <td style="padding:5px 0; font-weight:700; font-family:monospace; color:#003F72;">${applicationId}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:5px 0; font-weight:600; color:#64748B;">Assessment:</td>
                  <td style="padding:5px 0; font-weight:700; color:#0F172A;">${assessmentName}</td>
                </tr>
                <tr>
                  <td style="padding:5px 0; font-weight:600; color:#64748B;">Duration:</td>
                  <td style="padding:5px 0; font-weight:700; color:#0F172A;">${durationMins} Minutes</td>
                </tr>
                <tr>
                  <td style="padding:5px 0; font-weight:600; color:#64748B;">Questions:</td>
                  <td style="padding:5px 0; font-weight:700; color:#0F172A;">60 Questions (6 Sections)</td>
                </tr>
                ${activeUntil ? `<tr>
                  <td style="padding:5px 0; font-weight:600; color:#64748B;">Valid Until:</td>
                  <td style="padding:5px 0; font-weight:700; color:#D97706;">${new Date(activeUntil).toLocaleDateString()} ${new Date(activeUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                </tr>` : ''}
              </table>
            </td>
          </tr>
        </table>

        <!-- Call to Action Button -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 24px;">
          <tr>
            <td align="center">
              <a href="${examUrl}" target="_blank" style="display:inline-block; background:linear-gradient(135deg, #00AEEF 0%, #0090C8 100%); color:#ffffff; text-decoration:none; font-size:15px; font-weight:800; padding:15px 36px; border-radius:12px; box-shadow:0 6px 18px rgba(0,174,239,0.35); text-align:center;">
                Start Assessment Now &rarr;
              </a>
            </td>
          </tr>
        </table>

        <!-- Security & Instructions Banner -->
        <div style="background:#EFF6FF; border:1px solid #BFDBFE; border-radius:12px; padding:16px 20px; margin:0 0 24px; font-size:12px; color:#1E40AF; line-height:1.6;">
          <div style="font-weight:800; font-size:13px; color:#1E3A8A; margin-bottom:6px;">
            🛡️ Proctoring &amp; Technical Instructions:
          </div>
          <ul style="margin:0; padding-left:18px;">
            <li>Please ensure a stable internet connection and a functional webcam.</li>
            <li>Take the exam in a well-lit environment without background interruptions.</li>
            <li>Do not switch browser tabs or exit fullscreen mode during the examination.</li>
            <li>Your answers and progress are automatically saved in real-time.</li>
          </ul>
        </div>

        <!-- Direct URL Fallback -->
        <p style="font-size:11px; color:#94A3B8; line-height:1.5; margin:0; word-break:break-all;">
          If the button above does not open, copy and paste this link into your browser:<br/>
          <a href="${examUrl}" style="color:#00AEEF; text-decoration:underline;">${examUrl}</a>
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background:#F8FAFC; padding:20px 28px; text-align:center; font-size:11px; color:#64748B; border-top:1px solid #E2E8F0; line-height:1.6;">
        <p style="margin:0 0 4px; font-weight:700; color:#334155;">
          CCE Programme Team
        </p>
        <p style="margin:0;">
          This is an automated transactional invitation sent for recruitment evaluation. Please do not reply directly to this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  // ─── SEND SINGLE CANDIDATE INVITATION WITH ANTI-SPAM HEADERS & RETRY ───────
  async sendCandidateInvitation(candidateId: string, retryCount = 0): Promise<{ success: boolean; message: string; emailLogId?: string; error?: string }> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { assessment: true },
    });
    if (!candidate) throw new NotFoundException('Candidate not found.');

    const config = await this.getSmtpConfig();
    if (!config.username || !config.password) {
      await this.prisma.candidate.update({
        where: { id: candidate.id },
        data: { emailStatus: 'FAILED' },
      });
      return {
        success: false,
        message: 'SMTP credentials not configured. Please enter your SMTP Username & App Password in System Settings.',
        error: 'SMTP_NOT_CONFIGURED',
      };
    }

    const frontendBaseUrl = process.env.CANDIDATE_PORTAL_URL || process.env.FRONTEND_CANDIDATE_URL || 'https://niva.greatcampus.in';
    const examUrl = `${frontendBaseUrl}/${candidate.assessment.slug}?token=${candidate.secureToken || candidate.id}`;
    const refCode = candidate.applicationId || candidate.referenceId || candidate.id.slice(-6).toUpperCase();
    const subject = `Assessment Invitation: ${candidate.assessment.name} — ${candidate.name} [Ref: ${refCode}]`;

    const htmlContent = this.buildInvitationEmailHtml({
      candidateName: candidate.name,
      assessmentName: candidate.assessment.name,
      durationMins: candidate.assessment.durationMins || 45,
      examUrl,
      applicationId: candidate.applicationId || undefined,
      activeUntil: candidate.assessment.activeUntil ? candidate.assessment.activeUntil.toISOString() : undefined,
    });

    const textContent = this.buildInvitationEmailText({
      candidateName: candidate.name,
      assessmentName: candidate.assessment.name,
      durationMins: candidate.assessment.durationMins || 45,
      examUrl,
      applicationId: candidate.applicationId || undefined,
      activeUntil: candidate.assessment.activeUntil ? candidate.assessment.activeUntil.toISOString() : undefined,
    });

    let emailLog = await this.prisma.emailLog.create({
      data: {
        candidateId: candidate.id,
        recipientEmail: candidate.email,
        candidateName: candidate.name,
        assessmentName: candidate.assessment.name,
        assessmentId: candidate.assessmentId,
        subject,
        status: 'PENDING',
      },
    });

    try {
      const transporter = await this.createTransporter();
      const senderDomain = config.fromEmail.includes('@') ? config.fromEmail.split('@')[1] : 'greatcampus.in';
      const cleanMessageId = `<cce-${candidate.id}-${Date.now()}@${senderDomain}>`;
      const senderName = (!config.fromName || config.fromName.toLowerCase().includes('niva')) ? 'CCE Programme Team' : config.fromName;

      await transporter.sendMail({
        from: `"${senderName}" <${config.fromEmail}>`,
        to: candidate.email,
        replyTo: config.fromEmail,
        subject,
        text: textContent,
        html: htmlContent,
        messageId: cleanMessageId,
        headers: {
          'X-Mailer': 'CCE Programme Examination Notification Service',
          'X-Entity-Ref-ID': `${candidate.id}-${Date.now()}`,
          'X-Auto-Response-Suppress': 'All',
          'Auto-Submitted': 'auto-generated',
          'Precedence': 'bulk',
        },
      });

      emailLog = await this.prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          errorMessage: null,
        },
      });

      await this.prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          emailStatus: 'SENT',
          emailSentAt: new Date(),
        },
      });

      this.logger.log(`[Email Delivered] Sent invitation to ${candidate.email} (${candidate.name})`);

      return {
        success: true,
        message: `Invitation sent successfully to ${candidate.email}`,
        emailLogId: emailLog.id,
      };
    } catch (err: any) {
      this.logger.error(`[Email Failed] Attempt ${retryCount + 1} to ${candidate.email}: ${err.message}`);

      // Auto-retry once after 1000ms delay for transient network/handshake errors
      if (retryCount < 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.sendCandidateInvitation(candidateId, retryCount + 1);
      }

      try {
        await this.prisma.emailLog.update({
          where: { id: emailLog.id },
          data: {
            status: 'FAILED',
            errorMessage: err.message,
          },
        });
      } catch (_) {}

      try {
        await this.prisma.candidate.update({
          where: { id: candidate.id },
          data: { emailStatus: 'FAILED' },
        });
      } catch (_) {}

      return {
        success: false,
        message: `Email dispatch failed: ${err.message}`,
        error: err.message,
      };
    }
  }

  // ─── SMOOTH SEQUENTIAL BULK DISPATCH QUEUE (RATE-LIMITED & ANTI-DROP) ──────
  async sendBulkInvitations(data: { assessmentId: string; candidateIds?: string[] }) {
    const { assessmentId, candidateIds } = data;

    const config = await this.getSmtpConfig();
    const isSmtpConfigured = !!(config.username && config.password);

    const candidates = await this.prisma.candidate.findMany({
      where: {
        assessmentId,
        ...(candidateIds && candidateIds.length > 0 && { id: { in: candidateIds } }),
      },
      include: { assessment: true },
    });

    if (candidates.length === 0) {
      return { success: true, total: 0, sent: 0, failed: 0, errors: [] };
    }

    if (!isSmtpConfigured) {
      await this.prisma.candidate.updateMany({
        where: { id: { in: candidates.map((c) => c.id) } },
        data: { emailStatus: 'FAILED' },
      });

      return {
        success: false,
        total: candidates.length,
        sent: 0,
        failed: candidates.length,
        message: 'SMTP Credentials Not Configured: Please configure SMTP Host, Username, and Password in System Settings before sending real emails.',
        errors: candidates.map((c) => ({
          email: c.email,
          error: 'SMTP not configured in System Settings (/admin/settings).',
        })),
      };
    }

    let sent = 0;
    let failed = 0;
    const errors: Array<{ email: string; error: string }> = [];

    // Process sequentially with a 500ms delay between candidates to ensure no SMTP rate-limiting or connection drops
    this.logger.log(`[Bulk Email Queue] Starting smooth dispatch for ${candidates.length} candidate(s)...`);

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      try {
        const res = await this.sendCandidateInvitation(candidate.id);
        if (res.success) {
          sent++;
        } else {
          failed++;
          errors.push({ email: candidate.email, error: res.message || 'Send error' });
        }
      } catch (err: any) {
        failed++;
        errors.push({ email: candidate.email, error: err.message });
      }

      // Smooth 500ms throttle between emails to keep SMTP connections clean and VPS load minimal
      if (i < candidates.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    this.logger.log(`[Bulk Email Queue] Completed dispatch: ${sent} sent, ${failed} failed.`);

    return {
      success: sent > 0,
      total: candidates.length,
      sent,
      failed,
      errors,
    };
  }

  async resendEmail(emailLogId: string) {
    const log = await this.prisma.emailLog.findUnique({
      where: { id: emailLogId },
      include: { candidate: { include: { assessment: true } } },
    });
    if (!log || !log.candidate) throw new NotFoundException('Email log / Candidate record not found.');

    return this.sendCandidateInvitation(log.candidate.id);
  }

  async getEmailLogs(query: {
    page?: number;
    limit?: number;
    assessmentId?: string;
    status?: string;
    search?: string;
    vendorId?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.assessmentId) where.assessmentId = query.assessmentId;
    if (query.status && query.status !== 'ALL') where.status = query.status;
    if (query.vendorId) {
      where.candidate = {
        vendorId: query.vendorId,
      };
    }
    if (query.search) {
      where.OR = [
        { recipientEmail: { contains: query.search, mode: 'insensitive' } },
        { candidateName: { contains: query.search, mode: 'insensitive' } },
        { subject: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      this.prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.emailLog.count({ where }),
    ]);

    return {
      success: true,
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
