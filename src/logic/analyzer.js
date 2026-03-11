// Document Analysis Logic
// Analyzes text and returns a structured explanation

const DOCUMENT_PATTERNS = {
  contract: {
    keywords: ['rescisão', 'contrato', 'cláusula', 'vigência', 'locatário', 'locador', 'prestação', 'serviço'],
    type: 'Contrato',
    icon: '📝',
  },
  medical_prescription: {
    keywords: ['mg', 'comprimido', 'capsulas', 'dose', 'tomar', 'prescrição', 'receita', 'médico', 'posologia'],
    type: 'Bula / Prescrição Médica',
    icon: '💊',
  },
  exam: {
    keywords: ['exame', 'resultado', 'hemoglobina', 'glicose', 'colesterol', 'leucócitos', 'plaquetas', 'referência', 'laudo'],
    type: 'Exame Médico',
    icon: '🔬',
  },
  bill: {
    keywords: ['fatura', 'nota fiscal', 'vencimento', 'competência', 'kwh', 'consumo', 'tributos', 'taxa', 'multa'],
    type: 'Fatura / Conta',
    icon: '💰',
  },
  terms_of_service: {
    keywords: ['termos de uso', 'politica de privacidade', 'dados pessoais', 'lgpd', 'privacidade', 'usuário', 'plataforma'],
    type: 'Termos de Uso / Privacidade',
    icon: '🔒',
  },
};

const TECHNICAL_TERMS = {
  'rescisão contratual': 'cancelar o contrato antes do prazo combinado',
  'rescisão': 'cancelamento do contrato',
  'taxa de mora': 'multa cobrada por atraso no pagamento',
  'multa moratória': 'multa por atraso no pagamento',
  'vigência': 'período de tempo em que o contrato é válido',
  'locatário': 'a pessoa que está alugando o imóvel',
  'locador': 'o dono do imóvel que está alugando',
  'cláusula': 'uma regra específica dentro do contrato',
  'reajuste': 'aumento do valor por inflação ou índice combinado',
  'IGP-M': 'índice de inflação usado para reajuste de aluguéis',
  'IPCA': 'índice oficial de inflação do Brasil',
  'posologia': 'instrução de como e quando tomar o medicamento',
  'contraindição': 'situação em que o medicamento não pode ser usado',
  'efeito adverso': 'efeito colateral não desejado do medicamento',
  'plaquetas': 'células do sangue responsáveis pela coagulação',
  'hemoglobina': 'proteína no sangue que carrega oxigênio',
  'glicose': 'nível de açúcar no sangue',
  'colesterol LDL': 'colesterol ruim, pode entupir artérias',
  'colesterol HDL': 'colesterol bom, protege o coração',
  'tributo': 'imposto ou taxa cobrada pelo governo',
  'LGPD': 'Lei Geral de Proteção de Dados – regula como seus dados pessoais são usados',
};

function detectDocumentType(text) {
  const lowerText = text.toLowerCase();
  let bestMatch = { score: 0, type: 'Documento Geral', icon: '📄', key: 'general' };

  for (const [key, pattern] of Object.entries(DOCUMENT_PATTERNS)) {
    const score = pattern.keywords.filter(kw => lowerText.includes(kw)).length;
    if (score > bestMatch.score) {
      bestMatch = { score, type: pattern.type, icon: pattern.icon, key };
    }
  }
  return bestMatch;
}

function extractValues(text) {
  const values = [];

  // Money values (R$ patterns)
  const moneyRegex = /R\$\s*[\d.,]+/g;
  const moneyMatches = text.match(moneyRegex);
  if (moneyMatches) {
    values.push(`💵 Valores encontrados: ${[...new Set(moneyMatches)].join(', ')}`);
  }

  // Dates
  const dateRegex = /\d{1,2}\/\d{1,2}\/\d{2,4}/g;
  const dateMatches = text.match(dateRegex);
  if (dateMatches) {
    values.push(`📅 Datas: ${[...new Set(dateMatches)].join(', ')}`);
  }

  // Percentages
  const percRegex = /\d+[\.,]?\d*\s*%/g;
  const percMatches = text.match(percRegex);
  if (percMatches) {
    values.push(`📊 Taxas/Percentuais: ${[...new Set(percMatches)].join(', ')}`);
  }

  // Days/months (prazo)
  const dayRegex = /\d+\s*(dias|meses|anos|parcelas)/gi;
  const dayMatches = text.match(dayRegex);
  if (dayMatches) {
    values.push(`⏰ Prazos: ${[...new Set(dayMatches)].join(', ')}`);
  }

  return values.length > 0 ? values : ['Nenhum valor ou prazo específico encontrado no texto.'];
}

function extractRisks(text, docType) {
  const risks = [];
  const lowerText = text.toLowerCase();

  // Generic risk patterns
  if (lowerText.includes('multa') || lowerText.includes('penalidade')) {
    risks.push('⚠️ Este documento menciona multas ou penalidades. Verifique os valores exatos.');
  }
  if (lowerText.includes('juros')) {
    risks.push('⚠️ São cobrados juros. Veja a porcentagem e o prazo para evitar surpresas.');
  }
  if (lowerText.includes('rescisão') && lowerText.includes('unilateral')) {
    risks.push('⚠️ Rescisão unilateral: uma das partes pode cancelar o contrato sozinha. Verifique se isso inclui você.');
  }
  if (lowerText.includes('prazo de carência') || lowerText.includes('carência')) {
    risks.push('⚠️ Existe um prazo de carência. Você pode não poder cancelar logo no início.');
  }
  if (lowerText.includes('renovação automática') || lowerText.includes('renova automaticamente')) {
    risks.push('⚠️ Renovação automática: o contrato pode se renovar sem você precisar assinar novamente.');
  }
  if (lowerText.includes('reajuste')) {
    risks.push('⚠️ O documento prevê reajuste de valores. Verifique o índice e a periodicidade.');
  }

  // Medical risks
  if (docType.key === 'medical_prescription') {
    if (lowerText.includes('gravidez') || lowerText.includes('gestante')) {
      risks.push('⚠️ Atenção para uso durante a gravidez. Consulte seu médico antes.');
    }
    if (lowerText.includes('não dirigir') || lowerText.includes('sonolência')) {
      risks.push('⚠️ Este medicamento pode causar sonolência. Evite dirigir ou operar máquinas.');
    }
    if (lowerText.includes('álcool')) {
      risks.push('⚠️ Não combine este medicamento com álcool.');
    }
  }

  return risks.length > 0 ? risks : ['✅ Nenhum risco crítico identificado, mas leia todo o documento com atenção.'];
}

function findTermsInText(text) {
  const found = [];
  const lowerText = text.toLowerCase();
  for (const [term, explanation] of Object.entries(TECHNICAL_TERMS)) {
    if (lowerText.includes(term.toLowerCase())) {
      found.push({ term, explanation });
    }
  }
  return found;
}

function generateSummary(text, docType) {
  const wordCount = text.split(/\s+/).length;

  if (docType.key === 'contract') {
    return `Este é um ${docType.type} que estabelece direitos e obrigações entre as partes envolvidas. O documento tem aproximadamente ${wordCount} palavras. Leia com atenção antes de assinar, especialmente as partes sobre multas, prazos e formas de cancelamento.`;
  }
  if (docType.key === 'medical_prescription') {
    return `Este é um documento médico descrevendo um medicamento. Ele contém informações sobre para que serve, como usar, possíveis efeitos colaterais e precauções importantes. Sempre siga as instruções do seu médico.`;
  }
  if (docType.key === 'exam') {
    return `Este documento apresenta os resultados de exames médicos. Cada resultado é comparado com valores de referência para determinar se está normal, alto ou baixo. Sempre consulte um médico para interpretar seus exames.`;
  }
  if (docType.key === 'bill') {
    return `Este é um documento de cobrança ou fatura. Verifique se todos os valores estão corretos e se não há cobranças indevidas. Preste atenção à data de vencimento para evitar juros e multas.`;
  }
  if (docType.key === 'terms_of_service') {
    return `Este documento define as regras de uso de um serviço ou aplicativo e como seus dados pessoais serão tratados. É importante ler para saber o que você está concordando ao usar o serviço.`;
  }
  return `Este documento contém informações importantes. Analise-o com cuidado, prestando atenção a valores, prazos e obrigações mencionadas.`;
}

function generatePoints(text, docType) {
  const points = [];
  const lowerText = text.toLowerCase();

  // Pull some relevant points based on document type
  if (docType.key === 'contract') {
    if (lowerText.includes('prazo')) points.push('📆 O contrato tem um prazo definido.');
    if (lowerText.includes('valor') || lowerText.includes('preço')) points.push('💵 O documento especifica valores financeiros.');
    if (lowerText.includes('multa')) points.push('⚠️ Existe previsão de multa por descumprimento.');
    if (lowerText.includes('assinatura')) points.push('✍️ Requer assinatura de todas as partes.');
  }
  if (docType.key === 'medical_prescription') {
    if (lowerText.includes('dose')) points.push('💊 O medicamento tem uma dose específica prescrita.');
    if (lowerText.includes('efeito colateral') || lowerText.includes('efeito adverso')) points.push('⚠️ Existem efeitos colaterais a se atentar.');
    if (lowerText.includes('jejum')) points.push('🍽️ Pode haver instruções de uso em jejum.');
  }
  if (docType.key === 'bill') {
    if (lowerText.includes('vencimento')) points.push('📅 Há uma data de vencimento neste documento.');
    if (lowerText.includes('juros') || lowerText.includes('mora')) points.push('⚠️ Haverá cobranças adicionais em caso de atraso.');
    if (lowerText.includes('desconto')) points.push('✅ Existe possibilidade de desconto.');
  }

  if (points.length === 0) {
    points.push('📌 Documento recebido e processado.');
    points.push('📝 Identifique as partes envolvidas antes de tomar qualquer ação.');
    points.push('❓ Em caso de dúvidas, consulte um especialista.');
  }

  return points;
}

function generateDetailedExplanation(text, docType) {
  const explanations = {
    contract: `Um contrato é um acordo formal entre duas ou mais pessoas. Ele define:
    
1. **O que cada pessoa deve fazer**: Isso são as "obrigações". Por exemplo, uma parte paga e a outra entrega o serviço.
2. **Por quanto tempo**: O "prazo de vigência" diz quando o contrato começa e termina.
3. **O que acontece se alguém descumprir**: Geralmente são previstas multas.
4. **Como cancelar**: Processo de rescisão, com aviso prévio e possível multa.

Antes de assinar, certifique-se de entender cada cláusula. Se tiver dúvidas, peça ajuda de um advogado.`,

    medical_prescription: `Uma bula ou prescrição médica contém as seguintes informações importantes:

1. **Para que serve**: A indicação do medicamento, ou seja, quais doenças ou sintomas ele trata.
2. **Como tomar**: A posologia — quantidade, horário e forma de tomar.
3. **Efeitos colaterais**: Reações que o medicamento pode causar. Nem todos os usam, mas é importante estar ciente.
4. **Contraindicações**: Situações em que você NÃO deve tomar o medicamento.
5. **Interações**: Outros medicamentos ou alimentos que não podem ser combinados.

Sempre siga a prescrição do seu médico. Em caso de reação adversa, procure atendimento médico imediatamente.`,

    exam: `Um resultado de exame médico mostra o estado de saúde de diferentes partes do seu corpo. Cada resultado tem um valor de referência (o que é considerado normal):

1. **Resultado Baixo**: Pode indicar deficiência de alguma substância. O médico pode indicar suplementação.
2. **Resultado Normal**: Tudo dentro do esperado para uma pessoa saudável.
3. **Resultado Alto**: Pode indicar excesso de alguma substância ou uma condição a ser investigada.

Nunca interprete seus exames sozinho. Sempre leve ao seu médico para uma avaliação completa.`,

    bill: `Uma fatura ou conta de cobrança mostra o quanto você deve pagar e por quê:

1. **Valor principal**: O preço do serviço ou produto.
2. **Impostos e taxas**: Valores adicionais cobrados pelo governo (tributos).
3. **Data de vencimento**: O prazo máximo para pagar sem multa.
4. **Consequências do atraso**: Juros e multa por mora caso pague depois do vencimento.

Confira se todos os itens cobrados fazem sentido. Em caso de cobrança indevida, entre em contato com a empresa e exija uma explicação por escrito.`,

    terms_of_service: `Os Termos de Uso explicam as regras para usar um serviço digital:

1. **O que você pode fazer**: Ações permitidas dentro da plataforma.
2. **O que você não pode fazer**: Ações proibidas que podem levar ao cancelamento da conta.
3. **Seus dados pessoais**: Como a empresa coleta, usa e protege seus dados (LGPD).
4. **Como cancelar**: O processo para encerrar sua conta.
5. **Responsabilidades**: O que a empresa é responsável e o que não é.

Ao aceitar os termos, você concorda com todas as regras. Se não concordar com alguma coisa, pode não ser possível usar o serviço.`,

    general: `Este documento contém informações importantes que afetam você diretamente:

1. **Leia tudo com calma**: Não se apresse. Um bom entendimento evita problemas futuros.
2. **Identifique as partes**: Quem está envolvido no documento?
3. **Anote os valores e prazos**: São os pontos mais críticos.
4. **Guarde uma cópia**: Mantenha sempre uma cópia do documento.
5. **Em caso de dúvida**: Consulte um profissional especializado.`,
  };

  return explanations[docType.key] || explanations.general;
}

export function analyzeDocument(text) {
  if (!text || text.trim().length < 20) {
    return null;
  }

  const docType = detectDocumentType(text);
  const values = extractValues(text);
  const risks = extractRisks(text, docType);
  const terms = findTermsInText(text);
  const summary = generateSummary(text, docType);
  const points = generatePoints(text, docType);
  const detailed = generateDetailedExplanation(text, docType);

  return {
    docType,
    summary,
    points,
    values,
    risks,
    terms,
    detailed,
  };
}

export function answerQuestion(question, analysisResult) {
  if (!analysisResult) return 'Nenhum documento foi analisado ainda.';
  
  const q = question.toLowerCase();

  if (q.includes('multa') || q.includes('cancelar') || q.includes('rescisão')) {
    const riskAboutFine = analysisResult.risks.find(r => r.includes('multa') || r.includes('rescisão'));
    return riskAboutFine || 'O documento não menciona detalhes específicos sobre multa de cancelamento que possam ser identificados automaticamente. Procure pela palavra "rescisão" ou "multa" no texto original.';
  }

  if (q.includes('valor') || q.includes('pagar') || q.includes('quanto')) {
    return analysisResult.values.join('\n') || 'Não foi possível identificar valores específicos automaticamente.';
  }

  if (q.includes('risco') || q.includes('perigo') || q.includes('cuidado')) {
    return analysisResult.risks.join('\n');
  }

  if (q.includes('prazo') || q.includes('data') || q.includes('quando')) {
    const dateLine = analysisResult.values.find(v => v.includes('📅'));
    return dateLine || 'Não foram encontradas datas ou prazos específicos no texto.';
  }

  return 'Não encontrei uma resposta direta para sua pergunta no documento. Tente reformular ou verifique o texto completo.';
}
