const https = require("https");
const crypto = require("crypto");

/**
 * @public
 */
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

        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : `https://vargasjr-git-${sanitizedBranch}-team-36izpjku2llmshzqjzxmzppe.vercel.app`;

        return `${baseUrl}/api/ses/webhook`;
      }

      return process.env.WEBHOOK_URL;
    };

    const webhookUrl = new URL(getWebhookUrl(event.Records[0].ses));
    console.log("Final webhook URL:", webhookUrl.toString());
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

    const makeRequest = (requestOptions, attempt = 1) => {
      return new Promise((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            console.log(
              `Webhook response (attempt ${attempt}):`,
              res.statusCode,
              data
            );

            if (res.statusCode === 308) {
              console.log(
                "308 Redirect detected! Response headers:",
                JSON.stringify(res.headers, null, 2)
              );
              console.log(
                "Request URL was:",
                `https://${requestOptions.hostname}${requestOptions.path}`
              );

              if (attempt === 1) {
                console.log("Retrying with trailing slash...");
                const retryOptions = {
                  ...requestOptions,
                  path: requestOptions.path.endsWith("/")
                    ? requestOptions.path
                    : requestOptions.path + "/",
                };
                return makeRequest(retryOptions, 2).then(resolve).catch(reject);
              } else if (attempt === 2) {
                console.log("Retrying without trailing slash...");
                const retryOptions = {
                  ...requestOptions,
                  path: requestOptions.path.endsWith("/")
                    ? requestOptions.path.slice(0, -1)
                    : requestOptions.path,
                };
                return makeRequest(retryOptions, 3).then(resolve).catch(reject);
              }
            }

            resolve({
              statusCode: 200,
              body: JSON.stringify({ message: "Email processed successfully" }),
            });
          });
        });

        req.on("error", (error) => {
          console.error(`Webhook request failed (attempt ${attempt}):`, error);
          reject(error);
        });

        req.write(body);
        req.end();
      });
    };

    return makeRequest(options);
  } catch (error) {
    console.error("Error processing email:", error);
    throw error;
  }
};
