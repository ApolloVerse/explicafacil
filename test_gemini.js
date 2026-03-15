import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyAztcRalUrMmfXpKBecPfLCExuFa5xfFqE"; 
const genAI = new GoogleGenerativeAI(apiKey);

async function test() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContentStream([
      { text: "Diga 'A API ESTÁ FUNCIONANDO PERFEITAMENTE' e nada mais." },
    ]);
    for await (const chunk of result.stream) {
      process.stdout.write(chunk.text());
    }
    console.log("\n\nSUCCESS!");
  } catch (err) {
    console.error("EXPECTED ERROR:", err);
  }
}
test();
