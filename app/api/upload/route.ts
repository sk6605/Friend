import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { extractTextFromFile } from '@/app/lib/fileExtractor';
import { uploadToR2 } from '@/app/lib/r2';
import { prisma } from '@/app/lib/db';

// Default limits (will be overridden by user plan)
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const DEFAULT_MAX_FILES = 2;

const ALLOWED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'text/markdown': ['.md'],
  'application/json': ['.json'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
};

function isAllowedType(mimeType: string, fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  if (ALLOWED_TYPES[mimeType]) return true;
  const allExts = Object.values(ALLOWED_TYPES).flat();
  return allExts.includes(ext);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const userId = (formData.get('userId') as string) || null;

    // Fetch user's plan limits
    let maxFileSize = DEFAULT_MAX_FILE_SIZE;
    let maxFiles = DEFAULT_MAX_FILES;

    if (userId) {
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
        include: { plan: true },
      });
      if (subscription?.plan) {
        maxFileSize = (subscription.plan.maxFileSizeMB || 10) * 1024 * 1024;
        maxFiles = subscription.plan.maxFileUploads || 2;
      }
    }

    if (!files || files.length === 0) {
      return Response.json({ error: 'No files uploaded' }, { status: 400 });
    }

    if (files.length > maxFiles) {
      return Response.json(
        { error: `Too many files. Your current plan allows maximum ${maxFiles} files per upload.` },
        { status: 400 }
      );
    }

    // Validate all files before processing
    for (const file of files) {
      if (file.size > maxFileSize) {
        const sizeMsg = maxFileSize >= 1024 * 1024 
          ? `${maxFileSize / (1024 * 1024)} MB`
          : `${Math.round(maxFileSize / 1024)} KB`;
        return Response.json(
          { error: `File "${file.name}" exceeds your plan's ${sizeMsg} size limit.` },
          { status: 400 }
        );
      }
      if (!isAllowedType(file.type, file.name)) {
        return Response.json(
          { error: `File type not allowed: "${file.name}". Accepted: PDF, DOCX, PPT/PPTX, XLS/XLSX, TXT, CSV, MD, JSON, PNG, JPG, GIF, WebP.` },
          { status: 400 }
        );
      }
    }

    const results: { url: string; name: string; size: number; type: string; r2Key: string; extractedText?: string }[] = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const ext = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, '');
      const uniqueName = `${crypto.randomBytes(16).toString('hex')}${ext}`;

      // ─── Text extraction for documents ───
      // Write to /tmp temporarily ONLY for text extraction, then delete
      const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext);
      let extractedText: string | undefined;

      if (!isImage) {
        const tmpDir = '/tmp/uploads';
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        const tmpPath = path.join(tmpDir, uniqueName);
        try {
          fs.writeFileSync(tmpPath, buffer);
          extractedText = await extractTextFromFile(tmpPath, file.name);
        } catch (e) {
          console.error(`Text extraction failed for ${file.name}:`, e);
        } finally {
          // Always clean up temp file
          try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
        }
      }

      // ─── Upload to Cloudflare R2 for persistent storage ───
      const r2Key = `uploads/${uniqueName}`;
      const r2Url = await uploadToR2(r2Key, buffer, file.type || 'application/octet-stream');

      results.push({
        url: r2Url,
        name: file.name,
        size: file.size,
        type: file.type,
        r2Key,
        extractedText,
      });

      // Record file in UserFile table for file history
      if (userId) {
        prisma.userFile.create({
          data: {
            userId,
            name: file.name,
            url: r2Url,
            r2Key,
            size: file.size,
            type: file.type,
          },
        }).catch(err => console.error('Failed to save file record:', err));
      }
    }

    return Response.json({ files: results });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json(
      { error: 'File upload failed' },
      { status: 500 }
    );
  }
}
