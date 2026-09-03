import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const stamp = Date.now();
    const rand = crypto.randomBytes(4).toString('hex');
    const safe = file.originalname.replace(/[^\w.\-]/g, '_');
    cb(null, `${stamp}-${rand}-${safe}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB per file for the prototype
});

export function classifyFileType(mimetype = '', name = '') {
  const ext = path.extname(name).toLowerCase();
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype === 'application/pdf' || ext === '.pdf') return 'pdf';
  if (
    mimetype.startsWith('text/') ||
    /\.(doc|docx|txt|rtf|odt|csv|xls|xlsx)$/.test(ext) ||
    mimetype.includes('word') ||
    mimetype.includes('sheet')
  ) {
    return 'document';
  }
  return 'other';
}

export function hashFile(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}
