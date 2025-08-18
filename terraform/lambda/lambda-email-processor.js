const https = require("https");
const crypto = require("crypto");

exports.handler = async (event) => {
  console.log("Received SES event:", JSON.stringify(event, null, 2));

  try {
    const snsPayload = {
      Records: [
        {
          ses: event.Records[0].ses,
        },
      ],
    };

    const body = JSON.stringify(snsPayload);
    const webhookSecret = process.env.SES_WEBHOOK_SECRET;

    const hmac = crypto.createHmac("sha256", webhookSecret);
    hmac.update(body);
    const signature = hmac.digest("base64");

    const getWebhookUrl = (sesData) => {
      const subject = sesData.mail.commonHeaders.subject || "";
      const previewMatch = subject.match(/\[PREVIEW:\s*([^\]]+)\]/i);

      if (previewMatch) {
        const branchName = previewMatch[1].trim();
        console.log("Detected preview branch:", branchName);
        const sanitizedBranch = branchName.replace(/[^a-zA-Z0-9-]/g, "-");
        return `https://vargasjr-git-${sanitizedBranch}.vercel.app/api/ses/webhook`;
      }

      return process.env.WEBHOOK_URL;
    };

    const webhookUrl = new URL(getWebhookUrl(event.Records[0].ses));
    const options = {
      hostname: webhookUrl.hostname,
      port: 443,
      path: webhookUrl.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "x-amz-sns-message-signature": signature,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          console.log("Webhook response:", res.statusCode, data);
          resolve({
            statusCode: 200,
            body: JSON.stringify({ message: "Email processed successfully" }),
          });
        });
      });

      req.on("error", (error) => {
        console.error("Webhook request failed:", error);
        reject(error);
      });

      req.write(body);
      req.end();
    });
  } catch (error) {
    console.error("Error processing email:", error);
    throw error;
  }
};
