const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
  const apiKey = "AIzaSyAztcRalUrMmfXpKBecPfLCExuFa5xfFqE";
  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    console.log("--- LISTANDO MODELOS DISPONÍVEIS ---");
    // O SDK não tem um método direto 'listModels' no objeto genAI em algumas versões.
    // Vamos tentar buscar via fetch direto na API para garantir.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    if (data.models) {
      data.models.forEach(m => {
        console.log(`Model: ${m.name} | Methods: ${m.supportedGenerationMethods.join(", ")}`);
      });
    } else {
      console.log("Nenhum modelo retornado:", data);
    }
  } catch (error) {
    console.error("Erro ao listar modelos:", error);
  }
}

listModels();
