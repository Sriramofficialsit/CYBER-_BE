import { Router } from 'express';
import mongoose from 'mongoose';
import Case from '../models/Case.js';
import Evidence from '../models/Evidence.js';
import CaseLink from '../models/CaseLink.js';
import { requireAuth } from '../middleware/auth.js';
import { runPipelineAsync } from '../services/pipeline.js';

const router = Router();
router.use(requireAuth);

const isId = (v) => mongoose.Types.ObjectId.isValid(v);

// POST /api/cases — create a case; triggers the AI pipeline async
router.post('/', async (req, res, next) => {
  try {
    const {
      title,
      complainantName,
      complainantContact,
      fraudType,
      narrative,
      assignedOfficer,
      status,
      stage,
    } = req.body || {};

    if (!title || !narrative) {
      return res.status(400).json({ error: 'title and narrative are required' });
    }

    const kase = await Case.create({
      title,
      complainantName,
      complainantContact,
      fraudType,
      narrative,
      assignedOfficer: assignedOfficer || req.user?.name || 'investigator',
      status,
      stage,
    });

    runPipelineAsync(kase._id);
    return res.status(201).json(kase);
  } catch (err) {
    return next(err);
  }
});

// GET /api/cases — list/search (filter by status, fraudType, officer, q)
router.get('/', async (req, res, next) => {
  try {
    const { status, fraudType, officer, q } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (fraudType) filter.fraudType = fraudType;
    if (officer) filter.assignedOfficer = officer;
    if (q) {
      filter.$or = [
        { title: new RegExp(q, 'i') },
        { narrative: new RegExp(q, 'i') },
        { caseNumber: new RegExp(q, 'i') },
        { complainantName: new RegExp(q, 'i') },
      ];
    }
    const cases = await Case.find(filter).sort({ createdAt: -1 }).lean();

    // Attach a "links awaiting review" count per case for the dashboard.
    const counts = await CaseLink.aggregate([
      { $match: { officerVerdict: 'pending', aiConnected: true } },
      {
        $group: {
          _id: null,
          ids: { $push: '$caseA' },
          idsB: { $push: '$caseB' },
        },
      },
    ]);
    const pendingByCase = {};
    if (counts[0]) {
      for (const id of [...counts[0].ids, ...counts[0].idsB]) {
        pendingByCase[String(id)] = (pendingByCase[String(id)] || 0) + 1;
      }
    }
    return res.json(
      cases.map((c) => ({ ...c, pendingLinks: pendingByCase[String(c._id)] || 0 }))
    );
  } catch (err) {
    return next(err);
  }
});

// GET /api/cases/summary — dashboard counters
router.get('/summary', async (req, res, next) => {
  try {
    const [byStatus, pendingLinks, total] = await Promise.all([
      Case.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      CaseLink.countDocuments({ officerVerdict: 'pending', aiConnected: true }),
      Case.countDocuments(),
    ]);
    const status = Object.fromEntries(byStatus.map((s) => [s._id, s.n]));
    return res.json({ total, status, connectionsAwaitingReview: pendingLinks });
  } catch (err) {
    return next(err);
  }
});

// GET /api/cases/:id — case detail incl. evidence + links
router.get('/:id', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'bad id' });
    const kase = await Case.findById(req.params.id).lean();
    if (!kase) return res.status(404).json({ error: 'not found' });

    const [evidence, links] = await Promise.all([
      Evidence.find({ caseId: kase._id }).sort({ uploadedAt: -1 }).lean(),
      CaseLink.find({ $or: [{ caseA: kase._id }, { caseB: kase._id }] })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    // Resolve the "other" case for each link.
    const otherIds = links.map((l) =>
      String(l.caseA) === String(kase._id) ? l.caseB : l.caseA
    );
    const otherCases = await Case.find({ _id: { $in: otherIds } })
      .select('caseNumber title fraudType status')
      .lean();
    const otherById = Object.fromEntries(otherCases.map((c) => [String(c._id), c]));

    const decorated = links.map((l) => {
      const otherId =
        String(l.caseA) === String(kase._id) ? l.caseB : l.caseA;
      return { ...l, otherCase: otherById[String(otherId)] || null };
    });

    return res.json({ ...kase, evidence, links: decorated });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/cases/:id — update fields; re-run pipeline if narrative changed
router.patch('/:id', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'bad id' });
    const kase = await Case.findById(req.params.id);
    if (!kase) return res.status(404).json({ error: 'not found' });

    const editable = [
      'title',
      'complainantName',
      'complainantContact',
      'fraudType',
      'narrative',
      'status',
      'stage',
      'assignedOfficer',
    ];
    const narrativeBefore = kase.narrative;
    for (const key of editable) {
      if (key in (req.body || {})) kase[key] = req.body[key];
    }
    await kase.save();

    if (kase.narrative !== narrativeBefore) runPipelineAsync(kase._id);
    return res.json(kase);
  } catch (err) {
    return next(err);
  }
});

// GET /api/cases/:id/links — all AI-surfaced links for a case
router.get('/:id/links', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'bad id' });
    const id = new mongoose.Types.ObjectId(req.params.id);
    const links = await CaseLink.find({ $or: [{ caseA: id }, { caseB: id }] })
      .sort({ createdAt: -1 })
      .lean();
    return res.json(links);
  } catch (err) {
    return next(err);
  }
});

// POST /api/cases/:id/reanalyze — manually re-run the pipeline
router.post('/:id/reanalyze', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'bad id' });
    const kase = await Case.findById(req.params.id);
    if (!kase) return res.status(404).json({ error: 'not found' });
    await Case.updateOne({ _id: kase._id }, { $set: { 'analysis.state': 'pending' } });
    runPipelineAsync(kase._id);
    return res.json({ ok: true, message: 'Pipeline re-queued' });
  } catch (err) {
    return next(err);
  }
});

export default router;
