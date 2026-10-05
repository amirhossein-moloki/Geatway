export const CREATE_PAYMENT_SUCCESS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
        <bpPayRequestResponse xmlns="http://interfaces.core.mcp.billing.tehran.ir/">
            <return>0, AF82041a2Bf6989c7fF9</return>
        </bpPayRequestResponse>
    </soap:Body>
</soap:Envelope>`;

export const CREATE_PAYMENT_ERROR_XML = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
        <bpPayRequestResponse xmlns="http://interfaces.core.mcp.billing.tehran.ir/">
            <return>21</return>
        </bpPayRequestResponse>
    </soap:Body>
</soap:Envelope>`;

export const VERIFY_SUCCESS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
        <bpVerifyRequestResponse xmlns="http://interfaces.core.mcp.billing.tehran.ir/">
            <return>0</return>
        </bpVerifyRequestResponse>
    </soap:Body>
</soap:Envelope>`;

export const VERIFY_ALREADY_VERIFIED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
        <bpVerifyRequestResponse xmlns="http://interfaces.core.mcp.billing.tehran.ir/">
            <return>43</return>
        </bpVerifyRequestResponse>
    </soap:Body>
</soap:Envelope>`;

export const VERIFY_ERROR_XML = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
        <bpVerifyRequestResponse xmlns="http://interfaces.core.mcp.billing.tehran.ir/">
            <return>44</return>
        </bpVerifyRequestResponse>
    </soap:Body>
</soap:Envelope>`;

export const INQUIRY_SUCCESS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
        <bpInquiryRequestResponse xmlns="http://interfaces.core.mcp.billing.tehran.ir/">
            <return>0</return>
        </bpInquiryRequestResponse>
    </soap:Body>
</soap:Envelope>`;

export const REVERSAL_SUCCESS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
        <bpReversalRequestResponse xmlns="http://interfaces.core.mcp.billing.tehran.ir/">
            <return>0</return>
        </bpReversalRequestResponse>
    </soap:Body>
</soap:Envelope>`;

export const REFUND_SUCCESS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
        <bpRefundRequestResponse xmlns="http://interfaces.core.mcp.billing.tehran.ir/">
            <return>0</return>
        </bpRefundRequestResponse>
    </soap:Body>
</soap:Envelope>`;
