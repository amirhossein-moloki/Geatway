import { DepixPaymentApp } from './payment-app.js';

async function runCliTest() {
  console.log('====================================================');
  console.log('       Depix Payment Environment CLI Tester         ');
  console.log('====================================================\n');

  const app = new DepixPaymentApp();
  const gateways = app.getRegisteredGateways();

  console.log(`Registered Gateways: ${gateways.join(', ')}`);
  console.log(`USE_MOCK_GATEWAYS=${app.config.useMockGateways}`);
  console.log(`Environment Mode: ${app.config.environment}\n`);

  const results: Array<{ gateway: string; paymentId: string; status: string; success: boolean }> =
    [];

  for (const gatewayId of gateways) {
    console.log(`----------------------------------------------------`);
    console.log(`Testing Gateway: [${gatewayId.toUpperCase()}]`);

    try {
      // 1. Create Payment against Zibal Sandbox
      const paymentResult = await app.service.createPayment({
        gateway: gatewayId,
        amount: 50000,
        currency: 'IRR',
        description: `Depix Zibal Sandbox CLI Test`,
      });

      console.log(`  - Payment Created: ID = ${paymentResult.payment.id}`);
      console.log(`  - Status: ${paymentResult.status}`);
      console.log(`  - Gateway Track ID: ${paymentResult.gatewayTransactionId}`);
      console.log(
        `  - Action URL: ${paymentResult.actionUrl || paymentResult.redirectUrl || 'N/A'}`,
      );

      // 2. Simulate Zibal Callback
      const simulatedCallbackReq = {
        query: {
          trackId: paymentResult.gatewayTransactionId || '123456',
          success: '1',
          status: '2',
        },
        body: {},
        headers: {},
      };

      const callbackRes = await app.service.handleCallback(gatewayId, simulatedCallbackReq);
      console.log(`  - Callback Handled: isSuccess = ${callbackRes.isSuccess}`);

      // 3. Attempt Verification (Note: Zibal Sandbox verify will check if payment was completed in browser)
      try {
        const verifyRes = await app.service.verifyPayment({
          paymentId: paymentResult.payment.id,
          gatewayTransactionId: paymentResult.gatewayTransactionId,
        });
        console.log(
          `  - Payment Verified: Status = ${verifyRes.status}, Ref = ${verifyRes.reference}`,
        );
      } catch (verifyErr) {
        console.log(
          `  - Payment Verify Response from Zibal Sandbox: ${verifyErr instanceof Error ? verifyErr.message : verifyErr}`,
        );
      }

      // 4. Inquire Payment State
      const inquiryRes = await app.service.inquirePayment(paymentResult.payment.id);
      console.log(`  - Payment Inquired: Status = ${inquiryRes.status}`);

      results.push({
        gateway: gatewayId,
        paymentId: paymentResult.payment.id,
        status: inquiryRes.status,
        success: true,
      });
    } catch (err) {
      console.error(
        `  - ERROR on Gateway [${gatewayId}]:`,
        err instanceof Error ? err.message : err,
      );
      results.push({
        gateway: gatewayId,
        paymentId: 'N/A',
        status: 'FAILED',
        success: false,
      });
    }
  }

  console.log('\n====================================================');
  console.log('               CLI Test Summary                     ');
  console.log('====================================================');
  console.table(results);
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  runCliTest().catch((err) => {
    console.error('CLI Test Execution Error:', err);
    process.exit(1);
  });
}
