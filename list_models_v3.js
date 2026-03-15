import { GoogleGenerativeAI } from "@google/generative-ai";

async function listModels() {
  const apiKey = "AIzaSyAztcRalUrMmfXpKBecPfLCExuFa5xfFqE";
  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    console.log("--- BUSCANDO MODELOS DISPONÍVEIS ---");
    // Usando fetch direto para evitar problemas de SDK
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    if (data.models) {
      console.log("Modelos encontrados:");
      data.models.forEach(m => {
        console.log(`- ${m.name}`);
      });
    } else {
      console.log("Erro na resposta:", data);
    }
  } catch (error) {
    console.error("Erro fatal:", error);
  }
}

listModels();
