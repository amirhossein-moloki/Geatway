import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts', 'src/**/*.spec.ts'],
    alias: {
      '@amirhossein-moloki/sms-core': path.resolve(
        __dirname,
        '../../packages/sms-core/src/index.ts',
      ),
      '@amirhossein-moloki/sms-melipayamak': path.resolve(
        __dirname,
        '../../packages/sms-melipayamak/src/index.ts',
      ),
      '@amirhossein-moloki/sms-smsir': path.resolve(
        __dirname,
        '../../packages/sms-smsir/src/index.ts',
      ),
    },
  },
});
