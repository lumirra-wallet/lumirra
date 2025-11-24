import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer: MongoMemoryServer | null = null;

export async function connectDB() {
  try {
    // Use MongoDB Atlas if MONGODB_URI is provided, otherwise use in-memory MongoDB
    let MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
      console.log("No MONGODB_URI found, starting in-memory MongoDB server...");
      mongoServer = await MongoMemoryServer.create();
      MONGODB_URI = mongoServer.getUri();
      console.log("In-memory MongoDB server started at:", MONGODB_URI);
    }
    
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
}

export async function disconnectDB() {
  try {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  } catch (error) {
    console.error("MongoDB disconnection error:", error);
  }
}

export { mongoose };
