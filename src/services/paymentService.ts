export interface PixPaymentResponse {
  id: number;
  qr_code: string;
  qr_code_base64: string;
  status: string;
}

export const paymentService = {
  createPixPayment: async (email: string): Promise<PixPaymentResponse | null> => {
    try {
      // Calling our backend proxy instead of Mercado Pago directly
      const response = await fetch('/api/payment?action=create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
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
      // Calling our backend proxy
      const response = await fetch(`/api/payment?action=check&id=${paymentId}`);
      const data = await response.json();
      return data.status || 'pending';
    } catch (error) {
      console.error('[PAYMENT] Error checking status:', error);
      return 'error';
    }
  }
};
