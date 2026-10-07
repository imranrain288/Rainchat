import mongoose from 'mongoose';

let connectionPromise;

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return true;
  if (connectionPromise) return connectionPromise;

  const isLocalDevelopment = process.env.NODE_ENV !== 'production'
    && !process.env.VERCEL
    && !process.env.RENDER;
  const mongoUri = process.env.MONGO_URI
    || process.env.MONGODB_URI
    || (isLocalDevelopment && 'mongodb://imranrain288_db_user:l4E8H53hzYXvy7AC@ac-3apmkym-shard-00-00.ob3vclt.mongodb.net:27017,ac-3apmkym-shard-00-01.ob3vclt.mongodb.net:27017,ac-3apmkym-shard-00-02.ob3vclt.mongodb.net:27017?authSource=admin&replicaSet=atlas-ufmk7y-shard-0&tls=true');

  if (!mongoUri) {
    console.error('\x1b[31m✖ MongoDB Connection Error: Set MONGO_URI or MONGODB_URI\x1b[0m');
    return false;
  }

  connectionPromise = mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
  })
    .then((conn) => {
      console.log(`\x1b[32m✔ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}\x1b[0m`);
      return true;
    })
    .catch((error) => {
      console.error(`\x1b[31m✖ MongoDB Connection Error: ${error.message}\x1b[0m`);
      console.warn('\x1b[33m⚠ Check MongoDB URI configuration, DNS resolution, network access, and Atlas IP access rules.\x1b[0m');
      return false;
    })
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
};
