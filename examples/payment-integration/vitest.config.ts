import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    alias: {
      '@company/payment-service/testing': path.resolve(__dirname, '../../packages/payment-service/src/testing/index.ts'),
      '@company/payment-service': path.resolve(__dirname, '../../packages/payment-service/src/index.ts'),
      '@company/payment-core': path.resolve(__dirname, '../../packages/payment-core/src/index.ts'),
      '@company/payment-mellat': path.resolve(__dirname, '../../packages/payment-mellat/src/index.ts'),
      '@company/payment-zibal': path.resolve(__dirname, '../../packages/payment-zibal/src/index.ts'),
      '@company/payment-zarinpal': path.resolve(__dirname, '../../packages/payment-zarinpal/src/index.ts'),
      '@company/payment-saman': path.resolve(__dirname, '../../packages/payment-saman/src/index.ts'),
    },
  },
});
