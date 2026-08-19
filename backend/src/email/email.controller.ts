import { Controller, Get, Post, Body, Param, Query, Headers } from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('api/v1/emails')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get('smtp-config')
  async getSmtpConfig() {
    const config = await this.emailService.getSmtpConfig();
    return {
      success: true,
      config: {
        ...config,
        password: config.password ? '••••••••' : '',
      },
    };
  }

  @Post('smtp-config')
  async saveSmtpConfig(@Body() body: any) {
    const config = await this.emailService.saveSmtpConfig(body);
    return {
      success: true,
      message: 'SMTP settings updated successfully.',
      config: {
        ...config,
        password: config.password ? '••••••••' : '',
      },
    };
  }

  @Post('test-smtp')
  async testSmtpConnection(@Body() body: { targetEmail?: string }) {
    return this.emailService.testConnection(body.targetEmail);
  }

  @Post('send-invite/:candidateId')
  async sendCandidateInvitation(@Param('candidateId') candidateId: string) {
    return this.emailService.sendCandidateInvitation(candidateId);
  }

  @Post('send-bulk')
  async sendBulkInvitations(@Body() body: { assessmentId: string; candidateIds?: string[] }) {
    return this.emailService.sendBulkInvitations(body);
  }

  @Post('resend/:emailLogId')
  async resendEmail(@Param('emailLogId') emailLogId: string) {
    return this.emailService.resendEmail(emailLogId);
  }

  @Get('logs')
  async getEmailLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('assessmentId') assessmentId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('vendorId') vendorId?: string,
    @Headers('x-vendor-id') headerVendorId?: string,
    @Headers('x-user-role') userRole?: string,
  ) {
    const effectiveVendorId = userRole === 'VENDOR' ? (headerVendorId || vendorId) : vendorId;
    return this.emailService.getEmailLogs({ page, limit, assessmentId, status, search, vendorId: effectiveVendorId });
  }
}

