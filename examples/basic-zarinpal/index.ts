import { Payment } from '@company/payment-core';
import { ZarinpalGateway } from '@company/payment-zarinpal';

async function main() {
  const zarinpal = new ZarinpalGateway({
    accessToken: 'test_token',
    merchantId: '00000000-0000-0000-0000-000000000000',
    callbackUrl: 'https://example.com/callback',
  });

  const payment = Payment.create({
    id: 'zarinpal-demo-1',
    amount: 200000,
    currency: 'IRR',
    gatewayId: 'zarinpal',
    description: 'Zarinpal demo payment',
  });

  console.log('Created payment entity:', payment.id);
  console.log('Supported capabilities:', Array.from(zarinpal.capabilities));
}

main().catch(console.error);
