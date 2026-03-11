import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini client using the environment variable
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// Using flash for fast, cost-effective document parsing
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Store session history for Q&A contextual continuity
// In a real multi-user app, this would be managed per-user/session in a DB or Context
let chatSession = null;

export async function analyzeDocument(text) {
  if (!text || text.trim().length < 20) {
    return null;
  }

  if (!apiKey) {
    throw new Error('Chave da API do Gemini não configurada.');
  }

  const prompt = `
  Você é um assistente legal e financeiro de ponta, especializado em traduzir "juridiquês" e "médiquês" para uma linguagem extremamente simples e popular, acessível a qualquer pessoa leiga.
  
  Analise o documento abaixo e extraia as informações no seguinte formato JSON estrito, sem markdown, apenas o objeto JSON válido. Responda APENAS em PT-BR.

  Documento:
  """
  ${text}
  """

  Formato JSON obrigatório:
  {
    "docType": {
      "type": "Nome do tipo de documento (ex: Contrato de Locação, Bula, Fatura)",
      "icon": "Um emoji que represente o documento (ex: 📝, 💊, 💰)"
    },
    "summary": "Um resumo de 2 ou 3 frases explicando de forma MUITO SIMPLES sobre o que é o documento e qual a sua importância.",
    "points": [
      "Ponto chave 1 de forma simples e com um emoji no início",
      "Ponto chave 2...",
      "Ponto chave 3..."
    ],
    "values": [
      "💵 Valor exato X encontrado no texto",
      "📅 Data de vencimento ou prazo Y"
    ],
    "risks": [
      "⚠️ Explique um risco, multa, juros ou pegadinha encontrada no texto. Seja direto e proteja o usuário.",
      "⚠️ Outro risco ou efeito colateral se for bula..."
    ],
    "terms": [
      {
        "term": "Termo Técnico Complexo 1",
        "explanation": "Tradução do termo para linguagem do dia a dia (ex: 'Rescisão Unilateral' = 'Eles podem cancelar o contrato sozinhos sem te avisar')"
      }
    ],
    "detailed": "Uma explicação passo a passo do documento, dividida em parágrafos ou marcadores. Imagine que você está explicando esse papel para sua avó. Seja educado, paciente e evite palavras difíceis."
  }
  `;

  try {
    // We start a new chat session when analyzing a new document to keep context for future Q&A
    chatSession = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: "Vou te mandar um documento para análise e depois posso fazer perguntas sobre ele. Tudo bem?" }],
        },
        {
          role: "model",
          parts: [{ text: "Tudo bem! Pode enviar o documento. Vou analisá-lo e estarei pronto para responder qualquer pergunta que você tiver com base no texto fornecido." }],
        },
      ],
      generationConfig: {
        temperature: 0.1, // Low temp for more accurate, grounded data extraction
      },
    });

    const result = await chatSession.sendMessage(prompt);
    let responseText = result.response.text();
    
    // Clean up markdown formatting if the model still returns it
    responseText = responseText.replace(/```json\n/g, '').replace(/```\n?/g, '').trim();
    
    const parsedData = JSON.parse(responseText);
    
    // Ensure the structure matches what the frontend expects, adding fallback empty arrays if missing
    return {
      docType: parsedData.docType || { type: 'Documento', icon: '📄' },
      summary: parsedData.summary || 'Resumo indisponível.',
      points: parsedData.points || [],
      values: parsedData.values || [],
      risks: parsedData.risks || [],
      terms: parsedData.terms || [],
      detailed: parsedData.detailed || 'Explicação detalhada não disponível.',
    };

  } catch (error) {
    console.error('Erro na análise da IA:', error);
    throw new Error('Falha ao processar o documento com a inteligência artificial. O texto pode estar mal formatado ou a chave de API é inválida.');
  }
}

export async function answerQuestion(question, analysisResult) {
  if (!chatSession) {
    return 'Por favor, analise um documento primeiro antes de fazer perguntas.';
  }

  if (!apiKey) {
      throw new Error('Chave da API do Gemini não configurada.');
  }

  const prompt = `
  O usuário tem a seguinte dúvida sobre o documento que você acabou de analisar:
  Dúvida: "${question}"
  
  Responda de forma direta, simples e educada. Não use jargões difíceis. Baseie-se ESTRITAMENTE no documento fornecido anteriormente. Se a informação não estiver no documento, diga claramente: "O documento não menciona informações sobre isso."
  `;

  try {
    const result = await chatSession.sendMessage(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Erro no Q&A da IA:', error);
    return 'Desculpe, ocorreu um erro ao tentar responder sua pergunta. Tente novamente.';
  }
}
