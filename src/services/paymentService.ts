const MP_ACCESS_TOKEN = import.meta.env.VITE_MERCADO_PAGO_ACCESS_TOKEN;

export interface PixPaymentResponse {
  id: number;
  qr_code: string;
  qr_code_base64: string;
  status: string;
}

export const paymentService = {
  createPixPayment: async (email: string): Promise<PixPaymentResponse | null> => {
    try {
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
          payer: {
            email: email,
          }
        })
      });

      const data = await response.json();
      
      if (data.point_of_interaction?.transaction_data) {
        return {
          id: data.id,
          qr_code: data.point_of_interaction.transaction_data.qr_code,
          qr_code_base64: data.point_of_interaction.transaction_data.qr_code_base64,
          status: data.status
        };
      }
      return null;
    } catch (error) {
      console.error('[PAYMENT] Error creating PIX:', error);
      return null;
    }
  },

  checkPaymentStatus: async (paymentId: number): Promise<string> => {
    try {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
        }
      });
      const data = await response.json();
      return data.status || 'pending';
    } catch (error) {
      console.error('[PAYMENT] Error checking status:', error);
      return 'error';
    }
  }
};
