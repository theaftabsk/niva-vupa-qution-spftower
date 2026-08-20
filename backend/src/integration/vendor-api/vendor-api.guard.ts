import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VendorApiGuard implements CanActivate {
  private readonly logger = new Logger(VendorApiGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const apiKeyHeader =
      request.headers['x-api-key'] ||
      request.headers['x-vendor-api-key'] ||
      request.headers['api-key'];

    const authHeader = request.headers['authorization'];
    let apiKey: string | null = null;

    if (apiKeyHeader) {
      apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    } else if (authHeader && typeof authHeader === 'string') {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && (parts[0].toLowerCase() === 'bearer' || parts[0].toLowerCase() === 'apikey')) {
        apiKey = parts[1];
      } else {
        apiKey = authHeader;
      }
    }

    if (!apiKey) {
      this.logger.warn(`Vendor API call rejected: Missing API key in request headers.`);
      throw new UnauthorizedException(
        'Missing API key. Please provide your Vendor API key in the "x-api-key" or "Authorization: Bearer <key>" header.',
      );
    }

    const trimmedKey = apiKey.trim();

    // Look up vendor by apiKey
    const vendor = await this.prisma.vendor.findUnique({
      where: { apiKey: trimmedKey },
      include: {
        assignedAssessments: true,
      },
    });

    if (!vendor) {
      this.logger.warn(`Vendor API call rejected: Invalid API key provided.`);
      throw new UnauthorizedException('Invalid API key. Access denied.');
    }

    if (vendor.status !== 'ACTIVE') {
      this.logger.warn(`Vendor API call rejected: Vendor "${vendor.name}" is ${vendor.status}.`);
      throw new UnauthorizedException(
        `Your Vendor account is currently ${vendor.status}. Please contact the Super Administrator.`,
      );
    }

    // Attach vendor context to request
    request.vendor = vendor;
    request.vendorId = vendor.id;
    return true;
  }
}
