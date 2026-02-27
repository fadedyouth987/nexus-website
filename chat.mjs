import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Missing GEMINI_API_KEY. Create a .env file with GEMINI_API_KEY=...");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

const prompt = process.argv.slice(2).join(" ");

if (!prompt) {
  console.log("Ask me something! Example: npm run chat -- \"Hello\"");
} else {
  try {
    const result = await model.generateContent(prompt);
    console.log("\nNexGen Studio AI:", result.response.text());
  } catch (error) {
    console.error("Connection Error:", error.message);
  }
}
