import { Router } from 'express';
import mongoose from 'mongoose';
import CaseLink from '../models/CaseLink.js';
import Case from '../models/Case.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const isId = (v) => mongoose.Types.ObjectId.isValid(v);

// GET /api/links — all links, optional ?verdict= & ?reviewed=
router.get('/', async (req, res, next) => {
  try {
    const { verdict, reviewed } = req.query;
    const filter = {};
    if (verdict) filter.officerVerdict = verdict;
    if (reviewed === 'true') filter.officerReviewed = true;
    if (reviewed === 'false') filter.officerReviewed = false;
    const links = await CaseLink.find(filter).sort({ createdAt: -1 }).lean();

    const ids = [...new Set(links.flatMap((l) => [String(l.caseA), String(l.caseB)]))];
    const cases = await Case.find({ _id: { $in: ids } })
      .select('caseNumber title fraudType status')
      .lean();
    const byId = Object.fromEntries(cases.map((c) => [String(c._id), c]));
    return res.json(
      links.map((l) => ({
        ...l,
        caseADetail: byId[String(l.caseA)] || null,
        caseBDetail: byId[String(l.caseB)] || null,
      }))
    );
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/links/:id/review — officer confirms or dismisses a link
router.patch('/:id/review', async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'bad id' });
    const { verdict } = req.body || {};
    if (!['confirmed', 'dismissed', 'pending'].includes(verdict)) {
      return res.status(400).json({ error: 'verdict must be confirmed | dismissed | pending' });
    }
    const link = await CaseLink.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          officerVerdict: verdict,
          officerReviewed: verdict !== 'pending',
          reviewedBy: req.user?.name || 'investigator',
          reviewedAt: new Date(),
        },
      },
      { new: true }
    );
    if (!link) return res.status(404).json({ error: 'not found' });

    // Reflect a confirmed link on both case statuses (officer-driven, not auto).
    if (verdict === 'confirmed') {
      await Case.updateMany(
        { _id: { $in: [link.caseA, link.caseB] }, status: { $in: ['open', 'under_review'] } },
        { $set: { status: 'linked' } }
      );
    }
    return res.json(link);
  } catch (err) {
    return next(err);
  }
});

// GET /api/links/graph — nodes + confirmed-link edges for the network view
router.get('/graph', async (req, res, next) => {
  try {
    const includePending = req.query.includePending === 'true';
    const verdicts = includePending ? ['confirmed', 'pending'] : ['confirmed'];
    const links = await CaseLink.find({
      officerVerdict: { $in: verdicts },
      aiConnected: true,
    }).lean();
    const nodeIds = [
      ...new Set(links.flatMap((l) => [String(l.caseA), String(l.caseB)])),
    ];
    const cases = await Case.find({ _id: { $in: nodeIds } })
      .select('caseNumber title fraudType status')
      .lean();
    return res.json({
      nodes: cases.map((c) => ({
        id: String(c._id),
        label: c.caseNumber,
        title: c.title,
        fraudType: c.fraudType,
        status: c.status,
      })),
      edges: links.map((l) => ({
        source: String(l.caseA),
        target: String(l.caseB),
        linkType: l.linkType,
        verdict: l.officerVerdict,
        matchedOn: l.matchedOn,
        similarityScore: l.similarityScore,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
