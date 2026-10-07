import { Payment } from '@amirhossein-moloki/payment-core';
import { ZibalGateway } from '@company/payment-zibal';

async function main() {
  const zibal = new ZibalGateway({
    merchant: 'zibal',
    callbackUrl: 'https://example.com/callback',
  });

  const payment = Payment.create({
    id: 'zibal-demo-1',
    amount: 100000,
    currency: 'IRR',
    gatewayId: 'zibal',
    description: 'Zibal demo payment',
  });

  console.log('Created payment entity:', payment.id);
  console.log('Supported capabilities:', Array.from(zibal.capabilities));
}

main().catch(console.error);
