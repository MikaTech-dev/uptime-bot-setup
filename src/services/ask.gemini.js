import { GoogleGenAI } from "@google/genai";
import { logger } from "../utils/logger.config.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI, 
});

export async function askGemini(query) {
  const fullQuery = `${process.env.PERSONA} Now here's the query: ` + query;
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash", 
    contents: fullQuery 
});

  logger.info("LLM responded: ", response.text)
  return response.text;
};