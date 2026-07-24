// Quick debug
console.log("MONGODB_URI before import:", process.env.MONGODB_URI);
process.env.MONGODB_URI = "mongodb://localhost:27017/test-db";
console.log("MONGODB_URI after set:", process.env.MONGODB_URI);
import { createApp } from "../src/app.js";
console.log("MONGODB_URI after import:", process.env.MONGODB_URI);
const { config } = createApp();
console.log("config loaded, nodeEnv:", config.nodeEnv);
