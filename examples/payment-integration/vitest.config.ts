import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    alias: {
      '@amirhossein-moloki/payment-service/testing': path.resolve(
        __dirname,
        '../../packages/payment-service/src/testing/index.ts',
      ),
      '@amirhossein-moloki/payment-service': path.resolve(
        __dirname,
        '../../packages/payment-service/src/index.ts',
      ),
      '@amirhossein-moloki/payment-core': path.resolve(
        __dirname,
        '../../packages/payment-core/src/index.ts',
      ),
      '@amirhossein-moloki/payment-mellat': path.resolve(
        __dirname,
        '../../packages/payment-mellat/src/index.ts',
      ),
      '@amirhossein-moloki/payment-zibal': path.resolve(
        __dirname,
        '../../packages/payment-zibal/src/index.ts',
      ),
      '@amirhossein-moloki/payment-zarinpal': path.resolve(
        __dirname,
        '../../packages/payment-zarinpal/src/index.ts',
      ),
      '@amirhossein-moloki/payment-saman': path.resolve(
        __dirname,
        '../../packages/payment-saman/src/index.ts',
      ),
    },
  },
});
