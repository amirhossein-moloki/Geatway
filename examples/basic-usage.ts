import {
  Payment,
  PaymentService,
  GatewayRegistry,
  GatewayCapability,
  PaymentStatus,
  InMemoryIdempotencyStore,
} from '@company/payment-core';

async function main() {
  const registry = new GatewayRegistry();
  const idempotencyStore = new InMemoryIdempotencyStore();

  console.log('Payment Platform Initialized.');
  console.log('Capabilities available:', Object.values(GatewayCapability));

  await idempotencyStore.set('example_key', { status: 'processed' });
  const cached = await idempotencyStore.get('example_key');
  console.log('Idempotency store test:', cached);
}

main().catch(console.error);
