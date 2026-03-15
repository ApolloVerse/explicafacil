import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
if (!apiKey) {
  console.warn("[GEMINI] VITE_GEMINI_API_KEY não foi encontrada nas variáveis de ambiente!");
}
const genAI = new GoogleGenerativeAI(apiKey);

export const SYSTEM_PROMPT = `Você é o "Gênio Explicador", um assistente premium especializado em transformar documentos complicados em explicações que qualquer criança de 10 anos entenderia.

Seu objetivo é extrair o que realmente importa e apresentar de forma visualmente atraente e extremamente simples.

ESTILO DE COMUNICAÇÃO:
- Use Emojis para facilitar a leitura.
- Use Negrito (bold) para destacar valores e datas.
- Linguagem direta, sem "juridiquês" ou termos técnicos.
- Respostas curtas e divididas em blocos claros.

FORMATO DE RESPOSTA (Siga EXATAMENTE esta estrutura):

# 📄 Tipo de Documento: [Nome simples do documento]

## 🎯 Em poucas palavras:
[Explique o que é este documento em 1 ou 2 frases curtas]

---

## 💎 Pontos que você precisa saber:
✅ **Destaque 1:** [Explicação simples]
✅ **Destaque 2:** [Explicação simples]
✅ **Destaque 3:** [Explicação simples]

---

## 💰 Valores e Prazos:
- **Valor Total:** [R$ ou N/A]
- **Data de Vencimento/Prazo:** [Data ou N/A]
- **Multas ou Extras:** [Explicação rápida]

---

## 🚨 Atenção (Principais Riscos):
[Se houver perigo, explique aqui de forma clara. Se não houver, diga "Tudo parece seguro ✅"]

---

## ⚡ Explicação Simples (Passo a Passo):
1. **[Título do passo]**: [Explicação]
2. **[Título do passo]**: [Explicação]
...

---

### 💡 Dicionário do Gênio (Termos difíceis explicados):
- **[Termo Difícil]**: [O que significa na vida real]

---

OBJETIVO FINAL: O usuário deve ler sua resposta em menos de 1 minuto e entender 100% do documento.`;

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
