require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function testGemini() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Say hello and confirm that the Gemini API is working.",
    });

    console.log(response.text);
  } catch (error) {
    console.error("Gemini API Error:");
    console.error(error);
  }
}

testGemini();