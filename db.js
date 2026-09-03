import mongoose from 'mongoose';

let memoryServer = null;

export async function connectDb() {
  // Default to the in-process DB only for local dev. In production, or whenever a
  // real MONGO_URI is provided, use it — mongodb-memory-server is a devDependency
  // and won't exist on a production host.
  const explicit = process.env.USE_MEMORY_DB;
  const defaultMemory = process.env.NODE_ENV !== 'production' && !process.env.MONGO_URI;
  const useMemory =
    explicit != null ? explicit.toLowerCase() === 'true' : defaultMemory;

  let uri = process.env.MONGO_URI || 'mongodb://localhost:27017/cyber_investigation_prototype';

  if (useMemory) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('cyber_investigation_prototype');
    console.log('[db] using in-process MongoDB (mongodb-memory-server)');
  } else {
    console.log(`[db] connecting to ${uri}`);
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('[db] connected');
  return uri;
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
// hello
