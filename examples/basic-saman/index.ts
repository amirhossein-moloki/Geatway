import { Payment } from '@amirhossein-moloki/payment-core';
import { SamanGateway } from '@amirhossein-moloki/payment-saman';

async function main() {
  const saman = new SamanGateway({
    terminalId: '12571198',
    redirectUrl: 'https://example.com/return',
  });

  const payment = Payment.create({
    id: 'saman-demo-1',
    amount: 10000,
    currency: 'IRR',
    gatewayId: 'saman',
  });

  console.log('Created payment entity:', payment.id);
  console.log('Supported capabilities:', Array.from(saman.capabilities));
}

main().catch(console.error);
