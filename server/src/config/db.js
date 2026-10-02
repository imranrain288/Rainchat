import mongoose from 'mongoose';

let connectionPromise;

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return true;
  if (connectionPromise) return connectionPromise;

  connectionPromise = mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chatapp', {
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
