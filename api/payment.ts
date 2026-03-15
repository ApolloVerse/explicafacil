import type { VercelRequest, VercelResponse } from '@vercel/node';

const MP_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers for simplicity (Vite dev server)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
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
          'X-Idempotency-Key': `pix-${Date.now()}-${Math.random()}`
        },
        body: JSON.stringify({
          transaction_amount: 19.90,
          description: 'ExplicaFácil - Plano Premium (1 Mês)',
          payment_method_id: 'pix',
          payer: { email }
        })
      });

      const data = await response.json();
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
      return res.status(response.status).json(data);
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
