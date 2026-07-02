import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { createError } from './errorHandler';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(16).toString('hex');
    cb(null, `${name}${ext}`);
  },
});

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'application/pdf',
  'image/heic',
  'image/heif',
]);

// Magic-byte signatures for the formats we accept.
// We check the FIRST 12 bytes — sufficient for these formats.
function detectMimeFromBuffer(buf: Buffer): string | null {
  if (buf.length < 4) return null;

  // PDF: 25 50 44 46 ("%PDF")
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return 'application/pdf';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    return 'image/jpeg';
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return 'image/webp';
  }
  // TIFF: 49 49 2A 00 (little endian) or 4D 4D 00 2A (big endian)
  if (
    (buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2A && buf[3] === 0x00) ||
    (buf[0] === 0x4D && buf[1] === 0x4D && buf[2] === 0x00 && buf[3] === 0x2A)
  ) {
    return 'image/tiff';
  }
  // HEIC / HEIF: ftyp box at offset 4, brand at offset 8
  if (
    buf.length >= 12 &&
    buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70
  ) {
    const brand = buf.slice(8, 12).toString('ascii');
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1', 'heif'].includes(brand)) {
      return brand.startsWith('heif') || brand === 'mif1' || brand === 'msf1' ? 'image/heif' : 'image/heic';
    }
  }

  return null;
}

function fileFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (ALLOWED_MIMES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(createError(400, `Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, TIFF, PDF, HEIC, HEIF`));
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024,
    files: 20,
  },
});

/**
 * P1-7: After multer writes the file(s), sniff the leading bytes and reject
 * any whose actual content does not match an allowed format. We delete the
 * file from disk before responding.
 */
export async function verifyMagicBytes(req: Request, _res: Response, next: NextFunction) {
  try {
    const files: Express.Multer.File[] = [];
    if (Array.isArray(req.files)) {
      files.push(...(req.files as Express.Multer.File[]));
    } else if (req.files && typeof req.files === 'object') {
      for (const arr of Object.values(req.files)) {
        if (Array.isArray(arr)) files.push(...(arr as Express.Multer.File[]));
      }
    }
    if ((req as any).file) files.push((req as any).file);

    for (const f of files) {
      const fd = await fs.open(f.path, 'r');
      const buf = Buffer.alloc(16);
      await fd.read(buf, 0, 16, 0);
      await fd.close();
      const detected = detectMimeFromBuffer(buf);
      if (!detected || !ALLOWED_MIMES.has(detected)) {
        // Reject — delete to avoid retaining attacker content.
        await fs.unlink(f.path).catch(() => undefined);
        return next(createError(400, `File content does not match an allowed format: ${f.originalname}`));
      }
      // Stamp the verified mime onto the file object for downstream use.
      (f as any).verifiedMime = detected;
    }
    next();
  } catch (err) {
    next(err);
  }
}
