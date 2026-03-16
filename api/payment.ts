import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const MP_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 1. JWT Authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Auth required' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const { action } = req.query;

  try {
    if (action === 'create') {
      const { email } = req.body;
      const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `pix-${user.id}-${Date.now()}`
        },
        body: JSON.stringify({
          transaction_amount: 9.90,
          description: 'ExplicaFácil - Plano Premium',
          payment_method_id: 'pix',
          payer: { email: email || user.email }
        })
      });

      const data = await response.json();
      
      // 2. SANITIZATION (Problem Z & Risco 4)
      // Remove collector and seller details that might expose developer's PII
      if (data.point_of_interaction) {
        delete data.point_of_interaction.business_info;
        delete data.point_of_interaction.metadata;
      }
      if (data.collector) {
        delete data.collector; // Strip the entire collector object which contains names/emails
      }
      delete data.payer?.first_name;
      delete data.payer?.last_name;
      delete data.payer?.identification;

      return res.status(response.status).json(data);
    } 
    
    if (action === 'check') {
      const { id } = req.query;
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
        }
      });
      const data = await response.json();
      
      // Sanitization on status check too
      delete data.point_of_interaction;
      
      return res.status(response.status).json(data);
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro no processamento do pagamento' });
  }
}
