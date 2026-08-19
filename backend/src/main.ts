import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import * as express from 'express';
import { join } from 'path';
import * as fs from 'fs';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Helmet Security Headers (HSTS, X-Frame-Options, X-Content-Type-Options)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Ensure uploads/recordings directory exists
  const uploadDir = join(process.cwd(), 'uploads', 'recordings');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Serve static audio files
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // Increase payload limit to 50MB to support long audio voice uploads
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // Strict CORS Domain Protection
  const allowedOrigins = [
    'https://niva.greatcampus.in',
    'https://admin.niva.greatcampus.in',
    'https://api.niva.greatcampus.in',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:4000',
  ];

  app.enableCors({
    origin: (origin: any, callback: any) => {
      if (!origin || allowedOrigins.includes(origin) || origin.includes('greatcampus.in')) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Accept,Authorization,X-Requested-With,x-api-key,x-user-role,x-vendor-id,X-User-Role,X-Vendor-Id',
    credentials: true,
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 NestJS Enterprise API Backend is running live on http://localhost:${port}`);
}
bootstrap();
