import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ProctoringService {
  private readonly logger = new Logger(ProctoringService.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'screenshots');

  constructor(private readonly prisma: PrismaService) {
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Save uploaded Base64 or Binary Screenshot image to disk and record metadata in DB
   */
  async saveScreenshot(data: {
    attemptId: string;
    type: 'SCHEDULED' | 'WARNING';
    eventType?: string;
    imageBase64: string;
  }) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: data.attemptId },
    });

    if (!attempt) {
      throw new NotFoundException(`Exam attempt ${data.attemptId} not found.`);
    }

    try {
      // Clean base64 header if present
      const base64Data = data.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Ensure upload directory exists
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }

      const filename = `ss-${data.type.toLowerCase()}-${data.attemptId.slice(0, 8)}-${Date.now()}.jpg`;
      const filePath = path.join(this.uploadDir, filename);

      fs.writeFileSync(filePath, buffer);

      const relativeUrl = `/uploads/screenshots/${filename}`;

      const screenshotRecord = await this.prisma.proctoringScreenshot.create({
        data: {
          attemptId: data.attemptId,
          type: data.type,
          eventType: data.eventType || null,
          imageUrl: relativeUrl,
        },
      });

      this.logger.log(`Screenshot saved [${data.type}] for attempt ${data.attemptId}: ${relativeUrl}`);
      return { success: true, screenshot: screenshotRecord };
    } catch (error) {
      this.logger.error(`Failed to save screenshot for attempt ${data.attemptId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all screenshots for a specific exam attempt
   */
  async getScreenshotsForAttempt(attemptId: string) {
    return this.prisma.proctoringScreenshot.findMany({
      where: { attemptId },
      orderBy: { capturedAt: 'asc' },
    });
  }
}
