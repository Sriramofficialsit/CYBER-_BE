import Case from '../models/Case.js';
import { seedCases } from './cases.js';
import { runPipeline } from '../services/pipeline.js';

export async function seedIfEmpty() {
  const count = await Case.countDocuments();
  if (count > 0) {
    console.log(`[seed] skipped — ${count} case(s) already present`);
    return;
  }
  console.log(`[seed] inserting ${seedCases.length} synthetic cases...`);

  const created = [];
  for (const data of seedCases) {
    // eslint-disable-next-line no-await-in-loop
    const kase = await Case.create(data);
    created.push(kase);
  }

  // Run the pipeline sequentially so each case can be compared against the
  // embeddings of the ones already processed.
  for (const kase of created) {
    // eslint-disable-next-line no-await-in-loop
    await runPipeline(kase._id, { log: () => {} });
  }
  // Second pass so earlier cases also see links to later ones.
  for (const kase of created) {
    // eslint-disable-next-line no-await-in-loop
    await runPipeline(kase._id, { log: () => {} });
  }

  console.log('[seed] done — synthetic cases analysed and linked');
}

// Allow `npm run seed` against a real mongod.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed.js')) {
  const run = async () => {
    await import('dotenv/config');
    const { connectDb, disconnectDb } = await import('../db.js');
    await connectDb();
    await Case.deleteMany({});
    const { default: Evidence } = await import('../models/Evidence.js');
    const { default: CaseEmbedding } = await import('../models/CaseEmbedding.js');
    const { default: CaseLink } = await import('../models/CaseLink.js');
    await Promise.all([
      Evidence.deleteMany({}),
      CaseEmbedding.deleteMany({}),
      CaseLink.deleteMany({}),
    ]);
    await seedIfEmpty();
    await disconnectDb();
    process.exit(0);
  };
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
