import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
if (!apiKey) {
  console.warn("[GEMINI] VITE_GEMINI_API_KEY não foi encontrada nas variáveis de ambiente!");
}
const genAI = new GoogleGenerativeAI(apiKey);
OBJETIVA
FÁCIL DE ENTENDER`;

export async function* analyzeDocumentStream(fileData: string, mimeType: string) {
  try {
    console.log("[GEMINI] Starting stream analysis with model: gemini-flash-latest", { mimeType });
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    
    const result = await model.generateContentStream([
      { text: SYSTEM_PROMPT },
      {
        inlineData: {
          data: fileData.split(",")[1],
          mimeType: mimeType,
        },
      },
      { text: "Analise este documento seguindo as regras e o formato de resposta definidos." },
    ]);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      yield chunkText;
    }
  } catch (error: any) {
    console.error("Error in analyzeDocumentStream:", error);
    if (error.message?.includes("not found")) {
      throw new Error(`Modelo não encontrado ou indisponível. Detalhes: ${error.message}`);
    }
    throw error;
  }
}

export async function analyzeDocument(fileData: string, mimeType: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    
    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      {
        inlineData: {
          data: fileData.split(",")[1],
          mimeType: mimeType,
        },
      },
      { text: "Analise este documento seguindo as regras e o formato de resposta definidos." },
    ]);

    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error analyzing document:", error);
    throw error;
  }
}

export async function askQuestion(documentContext: string, question: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    
    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: `Contexto do Documento: ${documentContext}` },
      { text: `Pergunta do Usuário: ${question}` },
    ]);

    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error asking question:", error);
    throw error;
  }
}
