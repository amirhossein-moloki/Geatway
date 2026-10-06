import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    alias: {
      '@company/payment-service/testing': '/app/packages/payment-service/src/testing/index.ts',
      '@company/payment-service': '/app/packages/payment-service/src/payment-service.ts',
      '@company/payment-core': '/app/packages/payment-core/src/index.ts',
      '@company/payment-mellat': '/app/packages/payment-mellat/src/index.ts',
      '@company/payment-zibal': '/app/packages/payment-zibal/src/index.ts',
      '@company/payment-zarinpal': '/app/packages/payment-zarinpal/src/index.ts',
      '@company/payment-saman': '/app/packages/payment-saman/src/index.ts',
    },
  },
});
