import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import mongoose from 'mongoose';
import Case from '../models/Case.js';
import Evidence from '../models/Evidence.js';
import { requireAuth } from '../middleware/auth.js';
import { upload, hashFile, classifyFileType, UPLOAD_DIR } from '../middleware/upload.js';

const router = Router();
router.use(requireAuth);

const isId = (v) => mongoose.Types.ObjectId.isValid(v);

// POST /api/cases/:id/evidence — multipart upload (field name: "files")
router.post('/:id/evidence', upload.array('files', 10), async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'bad id' });
    const kase = await Case.findById(req.params.id);
    if (!kase) return res.status(404).json({ error: 'case not found' });
    if (!req.files?.length) return res.status(400).json({ error: 'no files' });

    const created = [];
    for (const file of req.files) {
      const fileHash = hashFile(file.path);
      const doc = await Evidence.create({
        caseId: kase._id,
        fileName: file.originalname,
        storedPath: path.relative(path.join(UPLOAD_DIR, '..'), file.path),
        fileHash,
        fileType: classifyFileType(file.mimetype, file.originalname),
        sizeBytes: file.size,
        uploadedBy: req.user?.name || 'investigator',
        uploadedAt: new Date(),
      });
      created.push(doc);
    }
    return res.status(201).json(created);
  } catch (err) {
    return next(err);
  }
});

// GET /api/cases/:id/evidence — list evidence for a case
router.get('/:id/evidence', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'bad id' });
    const items = await Evidence.find({ caseId: req.params.id })
      .sort({ uploadedAt: -1 })
      .lean();
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});

// GET /api/evidence/:evidenceId/download — stream the stored file
router.get('/evidence/:evidenceId/download', async (req, res, next) => {
  try {
    if (!isId(req.params.evidenceId)) return res.status(400).json({ error: 'bad id' });
    const ev = await Evidence.findById(req.params.evidenceId).lean();
    if (!ev) return res.status(404).json({ error: 'not found' });
    const abs = path.join(UPLOAD_DIR, '..', ev.storedPath);
    if (!fs.existsSync(abs)) return res.status(410).json({ error: 'file missing on disk' });
    return res.download(abs, ev.fileName);
  } catch (err) {
    return next(err);
  }
});

export default router;
