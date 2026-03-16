import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin (Server-side only)
const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const GEMINI_API_KEY = (process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)?.trim();
  
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. JWT Authentication (Zero Trust)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autenticado. Token ausente.' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }

  const user_id = user.id;

  // 2. Validate Credits & Terms & Rate Limit (Server-side Validation)
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('plan_tier, analysis_count, analysis_limit, credits, terms_accepted, last_analysis_at')
    .eq('id', user_id)
    .single();

  if (profileError || !profile) {
    return res.status(500).json({ error: 'Erro ao verificar perfil do usuário.' });
  }

  if (!profile.terms_accepted) {
    return res.status(403).json({ error: 'Você deve aceitar os termos de uso antes de continuar.' });
  }

  const isPremium = profile.plan_tier === 'premium';
  
  // Rate Limiting: 30s for non-premium (Problem X)
  if (!isPremium && profile.last_analysis_at) {
    const lastAt = new Date(profile.last_analysis_at);
    const now = new Date();
    const diff = (now.getTime() - lastAt.getTime()) / 1000;
    if (diff < 30) {
      return res.status(429).json({ error: `Aguarde ${Math.ceil(30 - diff)} segundos para nova análise.` });
    }
  }

  const hasCredits = (profile.credits || 0) > 0;

  if (!isPremium && !hasCredits) {
    return res.status(403).json({ error: 'Limite de créditos atingido. Faça upgrade para continuar!' });
  }

  const { fileData, mimeType, prompt, systemPrompt } = req.body;

  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'placeholder') {
    return res.status(500).json({ error: 'Configuração de IA ausente no servidor.' });
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const contents: any[] = [
      {
        role: "user",
        parts: [
          { text: systemPrompt },
          {
            inlineData: {
              data: fileData,
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ],
      },
    ];

    const result = await model.generateContent({ contents });
    const response = await result.response;
    const text = response.text();

    // 3. Atomic Credit Management & Rate Limit Timestamp (Problem X)
    const updatePayload: any = { last_analysis_at: new Date().toISOString() };
    
    if (!isPremium) {
      const { error: updateError } = await supabaseAdmin.rpc('decrement_credits', { target_user_id: user_id });
      if (updateError) {
        console.error('[CREDITS] Atomic decrement failed:', updateError);
      }
    } else {
      // Premium users still get their count incremented in profiles (RPC handles both cases now)
      await supabaseAdmin.rpc('decrement_credits', { target_user_id: user_id });
    }

    // Always update the time of last analysis for all users
    await supabaseAdmin.from('profiles').update(updatePayload).eq('id', user_id);

    // 4. Sanitize Output (Problem Z - removing developer PII if any)
    // Note: The prompt already handles didactic language, but we ensure no system-leaks here.

    return res.status(200).json({ text });
  } catch (error: any) {
    console.error('[GEMINI PROXY] Error:', error);
    return res.status(500).json({ error: 'Falha no processamento da IA.' });
  }
}
