import { GatewayRegistry, Payment } from '@amirhossein-moloki/payment-core';
import { MellatConfig, MellatGateway } from '@amirhossein-moloki/payment-mellat';

async function main() {
  console.log('--- Mellat Payment Gateway Example ---');

  const registry = new GatewayRegistry();

  const config: MellatConfig = {
    gatewayId: 'mellat-main',
    terminalId: '1234567',
    userName: 'merchantUser',
    userPassword: 'merchantPassword',
    callbackUrl: 'https://mywebsite.com/payment/callback',
  };

  const mockTransport = async (url: string, options: { body: string }) => {
    console.log(`\n[HTTP Request] POST -> ${url}`);
    console.log(`[Request Body Snippet] -> ${options.body.slice(0, 150)}...`);

    const xmlSuccessResponse = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
        <bpPayRequestResponse xmlns="http://interfaces.core.mcp.billing.tehran.ir/">
            <return>0, SAMPLE_REF_ID_123456789</return>
        </bpPayRequestResponse>
    </soap:Body>
</soap:Envelope>`;

    return {
      statusCode: 200,
      body: xmlSuccessResponse,
    };
  };

  const gateway = new MellatGateway(config, mockTransport);
  registry.register(gateway);

  const registeredGateway = registry.get('mellat-main') as MellatGateway;
  console.log(`Registered Gateway: ${registeredGateway.displayName}`);

  const payment = new Payment({
    id: 'ORDER_1001',
    amount: 500000,
    currency: 'IRR',
    gateway: 'mellat-main',
  });

  const response = await registeredGateway.createPayment({ payment });

  console.log('\n--- Payment Created ---');
  console.log(`Success: ${response.success}`);
  console.log(`Status: ${response.status}`);
  console.log(`RefId (Transaction ID): ${response.gatewayTransactionId}`);
  console.log(`Payment Page URL: ${response.redirectUrl}`);
  console.log('Redirect Form Fields:', response.metadata?.redirectFormData);
}

main().catch((err) => {
  console.error('Example failed:', err);
});
