import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
if (!apiKey) {
  console.warn("[GEMINI] VITE_GEMINI_API_KEY não foi encontrada nas variáveis de ambiente!");
}
const genAI = new GoogleGenerativeAI(apiKey);

export const SYSTEM_PROMPT = `Você é o "Gênio Explicador", um assistente didático especializado em transformar documentos extremamente complexos em explicações simples, claras e fáceis de entender, como se estivesse explicando para uma criança de 10 anos ou um leigo total.

Seu objetivo é remover toda a complexidade técnica e jurídica, focando apenas no que é essencial para o usuário saber.

ESTILO DE COMUNICAÇÃO:
- Extremamente Simples e Didático.
- Use Emojis para tornar a leitura amigável.
- Use Negrito (bold) apenas para dados cruciais (valores, nomes, datas).
- Proibido usar termos técnicos sem explicá-los imediatamente.
- Divida a resposta em blocos visuais claros.

FORMATO DE RESPOSTA (SIGA EXATAMENTE ESTA ESTRUTURA):

# 📄 Documento: [Nome amigável do documento]

## 🎯 O que é isso? (Resumo em 1 frase)
[Explicação ultra simples em uma frase]

---

## 💎 Os 3 pontos mais importantes:
1. ✅ **[Ponto 1]:** [Explicação clara]
2. ✅ **[Ponto 2]:** [Explicação clara]
3. ✅ **[Ponto 3]:** [Explicação clara]

---

## 💰 Dinheiro e Prazos:
- **Quanto custa/recebe:** [Valor em R$ ou "Não se aplica"]
- **Até quando:** [Data limite ou "Não se aplica"]
- **Multas ou Extras:** [O que acontece se atrasar - explique de forma simples]

---

## 🚨 Atenção (Cuidado com isso!):
[Destaque qualquer risco ou algo que o usuário precise tomar ação. Se estiver tudo bem, diga: "Tudo certo e seguro! ✅"]

---

## ⚡ Passo a Passo (O que fazer agora?):
1. **[Ação 1]**: [Explicação]
2. **[Ação 2]**: [Explicação]

---

### 💡 Traduzindo o "Dificíles" (Termos complicados):
- **[Termo do Documento]**: [Significado na vida real]

---

MENSAGEM FINAL: O usuário deve ler isso em 30 segundos e se sentir confiante de que entendeu tudo.`;

export async function* analyzeDocumentStream(fileData: string, mimeType: string, token: string) {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        fileData: fileData.split(",")[1],
        mimeType: mimeType,
        systemPrompt: SYSTEM_PROMPT,
        prompt: "Analise este documento seguindo as regras e o formato de resposta definidos."
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro na análise do documento');
    }

    const data = await response.json();
    // Simulate streaming for compatibility with App.tsx
    const words = data.text.split(' ');
    for (const word of words) {
      yield word + ' ';
      await new Promise(r => setTimeout(r, 5)); // Small delay for effect
    }
  } catch (error: any) {
    console.error("Error in analyzeDocumentStream:", error);
    throw error;
  }
}

export async function analyzeDocument(fileData: string, mimeType: string, token: string) {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        fileData: fileData.split(",")[1],
        mimeType: mimeType,
        systemPrompt: SYSTEM_PROMPT,
        prompt: "Analise este documento seguindo as regras e o formato de resposta definidos."
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro na análise do documento');
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Error analyzing document:", error);
    throw error;
  }
}

export async function askQuestion(documentContext: string, question: string, token: string) {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        fileData: "", // No file for follow-up questions but could be base64 if needed
        mimeType: "text/plain",
        systemPrompt: SYSTEM_PROMPT,
        prompt: `Contexto do Documento: ${documentContext}\n\nPergunta do Usuário: ${question}`
      })
    });

    const data = await response.json();
    if (!data.text) {
      throw new Error('A IA não retornou uma resposta válida. Verifique a chave de API.');
    }
    return data.text;
  } catch (error: any) {
    console.error("Error asking question:", error);
    throw new Error(`Falha na conversa com a IA: ${error.message}`);
  }
}
