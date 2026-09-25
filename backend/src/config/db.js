import mongoose from 'mongoose';

let dbConnected = false;

export const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/netflix_watch_party';
  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 3000,
    });
    dbConnected = true;
    console.log(`[MongoDB] Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    dbConnected = false;
    console.warn(`[MongoDB Notice] MongoDB not active at ${mongoURI}. Running ultra-fast In-Memory Room & Message Engine.`);
    return false;
  }
};

export const isDbConnected = () => dbConnected;
