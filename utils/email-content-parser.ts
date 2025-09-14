import { JSDOM } from 'jsdom';

export function cleanEmailContent(rawContent: string): string {
  if (!rawContent || typeof rawContent !== 'string') {
    return '';
  }

  let content = rawContent;

  if (content.includes('<html') || content.includes('<!DOCTYPE')) {
    try {
      const dom = new JSDOM(content);
      content = dom.window.document.body?.textContent || content;
    } catch (error) {
      console.warn('Failed to parse HTML email content:', error);
    }
  }

  const forwardingPatterns = [
    /---------- Forwarded message ----------[\s\S]*?(?=\n\n|\nFrom:|\nDate:|$)/gi,
    /Begin forwarded message:[\s\S]*?(?=\n\n|\nFrom:|\nDate:|$)/gi,
    /-----Original Message-----[\s\S]*?(?=\n\n|\nFrom:|\nDate:|$)/gi,
    /From:[\s\S]*?Sent:[\s\S]*?To:[\s\S]*?Subject:[\s\S]*?(?=\n\n|$)/gi,
    /On .* wrote:[\s\S]*?(?=\n\n|$)/gi,
  ];

  for (const pattern of forwardingPatterns) {
    const match = content.match(pattern);
    if (match) {
      const forwardingEnd = content.indexOf(match[0]) + match[0].length;
      content = content.substring(forwardingEnd).trim();
      break;
    }
  }

  const lines = content.split('\n');
  const cleanedLines: string[] = [];
  let skipHeaders = true;
  let inSignature = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (skipHeaders && !line) {
      continue;
    }
    
    if (skipHeaders) {
      if (line.match(/^(Return-Path|Received|Message-ID|Date|From|To|Subject|Cc|Bcc|Reply-To|MIME-Version|Content-Type|Content-Transfer-Encoding|X-.*?):\s/i)) {
        continue;
      } else if (line) {
        skipHeaders = false;
      }
    }

    if (line.match(/^--\s*$/) || 
        line.match(/^_{3,}$/) || 
        line.match(/^-{3,}$/) ||
        line.match(/^Sent from my (iPhone|iPad|Android)/i) ||
        line.match(/^Get Outlook for/i) ||
        line.match(/^This email was sent to .* by/i)) {
      inSignature = true;
    }

    if (inSignature) {
      continue;
    }

    if (!skipHeaders) {
      cleanedLines.push(lines[i]); // Keep original formatting
    }
  }

  let result = cleanedLines.join('\n').trim();
  
  result = result.replace(/\n{3,}/g, '\n\n');
  
  result = result.replace(/=\d{2}/g, ''); // Remove quoted-printable artifacts like =E2=80=99
  result = result.replace(/=\n/g, ''); // Remove soft line breaks
  
  return result;
}
