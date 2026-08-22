import { Controller, Post, Get, Body, Param, Logger } from '@nestjs/common';
import { ProctoringService } from './proctoring.service';

@Controller('api/v1')
export class ProctoringController {
  private readonly logger = new Logger(ProctoringController.name);

  constructor(private readonly proctoringService: ProctoringService) {}

  @Post(['proctoring/upload-screenshot', 'candidates/proctoring/upload-screenshot'])
  async uploadScreenshot(
    @Body()
    body: {
      attemptId: string;
      type?: 'SCHEDULED' | 'WARNING';
      eventType?: string;
      imageBase64?: string;
      screenshotDataUrl?: string;
    },
  ) {
    const rawImage = body.imageBase64 || body.screenshotDataUrl;
    if (!body.attemptId || !rawImage) {
      return { success: false, message: 'attemptId and image (imageBase64 or screenshotDataUrl) are required.' };
    }

    const result = await this.proctoringService.saveScreenshot({
      attemptId: body.attemptId,
      type: body.type || 'SCHEDULED',
      eventType: body.eventType || 'ROUTINE',
      imageBase64: rawImage,
    });
    return result;
  }

  @Get('proctoring/screenshots/:attemptId')
  async getScreenshots(@Param('attemptId') attemptId: string) {
    const screenshots = await this.proctoringService.getScreenshotsForAttempt(attemptId);
    return { success: true, count: screenshots.length, screenshots };
  }
}
