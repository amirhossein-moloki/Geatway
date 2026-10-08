import { DepixPaymentApp } from './payment-app.js';
import { createHttpServer } from './server.js';

export async function startServer() {
  const app = new DepixPaymentApp();
  const server = createHttpServer(app);

  server.listen(app.config.port, () => {
    console.log(`[Depix Test] Payment environment running at http://localhost:${app.config.port}`);
    console.log(`[Depix Test] Environment mode: ${app.config.environment}`);
    console.log(`[Depix Test] Use mock gateways: ${app.config.useMockGateways}`);
    console.log(`[Depix Test] Registered gateways: ${app.getRegisteredGateways().join(', ')}`);
  });

  return { app, server };
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  startServer().catch((err) => {
    console.error('[Depix Test] Server startup error:', err);
    process.exit(1);
  });
}
