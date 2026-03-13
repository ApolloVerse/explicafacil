import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const SYSTEM_PROMPT = `Você é um assistente especializado em analisar e explicar documentos complexos em linguagem simples e acessível. Seu objetivo é ajudar qualquer pessoa a entender rapidamente documentos que normalmente exigiriam conhecimento jurídico, técnico ou médico.

REGRAS DE FUNCIONAMENTO:
1. Sempre comece identificando qual é o tipo de documento.
2. Faça um resumo simples do documento em poucas frases.
3. Destaque os pontos mais importantes que o usuário precisa entender.
4. Identifique valores, prazos, multas, taxas ou obrigações.
5. Se houver riscos para o usuário, destaque e explique claramente.
6. Traduza termos jurídicos ou técnicos para linguagem comum.
7. Use frases curtas e fáceis de entender.
8. Não use linguagem jurídica complicada.
9. Quando possível, utilize exemplos simples.

FORMATO DE RESPOSTA (Use Markdown):

# Tipo de documento:
[identifique o tipo]

## Resumo simples:
[explique o documento em poucas frases simples]

## Pontos importantes:
- ponto 1
- ponto 2

## Valores e prazos:
[listar valores, datas e prazos encontrados]

## Possíveis riscos ou alertas:
[explique qualquer cláusula perigosa, multa ou obrigação relevante]

## Explicação detalhada em linguagem simples:
[explique o documento passo a passo de forma clara]

## Termos Técnicos Explicados:
- **Termo**: Explicação simples.

---
Se o usuário fizer perguntas, responda apenas com base no documento em linguagem simples.`;

export async function analyzeDocument(fileData: string, mimeType: string) {
  const model = ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          {
            inlineData: {
              data: fileData.split(",")[1],
              mimeType: mimeType,
            },
          },
          { text: "Analise este documento seguindo as regras e o formato de resposta definidos." },
        ],
      },
    ],
  });

  const response = await model;
  return response.text;
}

export async function askQuestion(documentContext: string, question: string) {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          { text: `Contexto do Documento: ${documentContext}` },
          { text: `Pergunta do Usuário: ${question}` },
        ],
      },
    ],
  });

  const response = await model;
  return response.text;
}
