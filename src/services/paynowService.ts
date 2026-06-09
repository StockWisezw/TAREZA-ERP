/**
 * TAREZA TECHNOLOGIES - Paynow Zimbabwe Integration Service
 * Paynow Gateway Details:
 * - Integration ID: 25065
 * - Integration Key: 6e8f5604-5749-47c9-9861-e39bc3910119
 */

export interface PaynowOrder {
  id: string; // Unique order/reference identifier
  businessId: string;
  customerEmail: string;
  amount: number;
  description: string;
  phone?: string;
  method?: 'visa' | 'ecocash' | 'onemoney' | 'paynow_web' | 'cards';
}

/**
 * Initiates a Paynow Zimbabwe payment.
 * 
 * Since direct browser-to-Paynow requests are blocked by CORS policies,
 * this function requests the transaction via our secure backend proxy endpoint
 * which keeps API keys concealed and guarantees end-to-end reliability.
 * 
 * @param order Object detailing the amount, email, and reference to pay.
 * @returns Object with redirection or mobile money instructions.
 */
export async function initiatePayment(order: PaynowOrder): Promise<{
  success: boolean;
  redirectUrl?: string;
  pollUrl?: string;
  instructions?: string;
  error?: string;
}> {
  try {
    const isBrowser = typeof window !== 'undefined';
    
    // In browser/Vite environment, we routing via secure backend proxy to bypass browser CORS constraints
    if (isBrowser) {
      const response = await fetch('/api/paynow/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          business_id: order.businessId || 'default',
          email: order.customerEmail || 'billing@tareza.co.zw',
          amount: order.amount,
          phone: order.phone || '',
          method: order.method || 'paynow_web'
        }),
      });

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.error || 'Failed to initiate secure Paynow payment.'
        };
      }

      return {
        success: true,
        redirectUrl: result.redirectUrl,
        pollUrl: result.pollUrl,
        instructions: result.instructions
      };
    } else {
      // Server-side environment: we can communicate with Paynow's API endpoints directly
      // utilizing the official paynow Node package dynamically.
      const { Paynow } = await import('paynow');
      const integrationId = "25065";
      const integrationKey = "6e8f5604-5749-47c9-9861-e39bc3910119";
      
      const returnUrl = `http://localhost:3000/dashboard`;
      const resultUrl = `http://localhost:3000/api/paynow/callback`;
      
      const paynow = new Paynow(integrationId, integrationKey, resultUrl, returnUrl);
      const payment = paynow.createPayment(order.id, order.customerEmail);
      payment.add(order.description, order.amount);

      if (order.method === 'ecocash' || order.method === 'onemoney') {
        const provider = order.method === 'onemoney' ? 'onemoney' : 'ecocash';
        const response = await paynow.sendMobile(payment, order.phone || '', provider);
        if (response && response.success) {
          return {
            success: true,
            pollUrl: response.pollUrl,
            instructions: response.instructions
          };
        }
        return {
          success: false,
          error: response.error || 'Mobile push failed'
        };
      } else {
        const response = await paynow.send(payment);
        if (response && response.success) {
          return {
            success: true,
            redirectUrl: response.redirectUrl,
            pollUrl: response.pollUrl
          };
        }
        return {
          success: false,
          error: response.error || 'Direct web payments initiation failed'
        };
      }
    }
  } catch (error: any) {
    console.error('Error in PaynowService:', error);
    return {
      success: false,
      error: error?.message || String(error),
    };
  }
}
