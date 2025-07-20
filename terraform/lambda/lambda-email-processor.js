const https = require('https');
const crypto = require('crypto');

exports.handler = async (event) => {
    console.log('Received SES event:', JSON.stringify(event, null, 2));
    
    try {
        const snsPayload = {
            Records: [{
                ses: event.Records[0].ses
            }]
        };
        
        const body = JSON.stringify(snsPayload);
        const webhookSecret = process.env.SES_WEBHOOK_SECRET;
        
        const hmac = crypto.createHmac('sha256', webhookSecret);
        hmac.update(body);
        const signature = hmac.digest('base64');
        
        const getWebhookUrl = () => {
            const testWebhookUrl = process.env.TEST_WEBHOOK_URL;
            const isTestMode = process.env.LAMBDA_TEST_MODE === 'true';
            
            if (isTestMode && testWebhookUrl) {
                console.log('Using test webhook URL:', testWebhookUrl);
                return testWebhookUrl;
            }
            
            return process.env.WEBHOOK_URL;
        };

        const webhookUrl = new URL(getWebhookUrl());
        const options = {
            hostname: webhookUrl.hostname,
            port: 443,
            path: webhookUrl.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'x-amz-sns-message-signature': signature
            }
        };
        
        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    console.log('Webhook response:', res.statusCode, data);
                    resolve({
                        statusCode: 200,
                        body: JSON.stringify({ message: 'Email processed successfully' })
                    });
                });
            });
            
            req.on('error', (error) => {
                console.error('Webhook request failed:', error);
                reject(error);
            });
            
            req.write(body);
            req.end();
        });
        
    } catch (error) {
        console.error('Error processing email:', error);
        throw error;
    }
};
