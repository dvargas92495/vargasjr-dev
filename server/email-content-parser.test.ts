import { describe, it, expect } from 'vitest';
import { cleanEmailContent } from './email-content-parser';

describe('cleanEmailContent', () => {
  it('should handle forwarded emails with Gmail format', () => {
    const forwardedEmail = `
Return-Path: <sender@example.com>
Received: from mail.example.com
Date: Mon, 1 Jan 2024 12:00:00 +0000

---------- Forwarded message ----------
From: John Doe <john@example.com>
Date: Mon, 1 Jan 2024 at 11:00 AM
Subject: Test Subject
To: recipient@example.com

Hi there,

This is the actual email content that should be preserved.

Best regards,
John
`;

    const cleaned = cleanEmailContent(forwardedEmail);
    expect(cleaned).toBe("Hi there,\n\nThis is the actual email content that should be preserved.\n\nBest regards,\nJohn");
  });

  it('should handle HTML emails', () => {
    const htmlEmail = `
<html>
<body>
<p>Hello World</p>
<p>This is an HTML email.</p>
</body>
</html>
`;

    const cleaned = cleanEmailContent(htmlEmail);
    expect(cleaned).toBe("Hello World\nThis is an HTML email.");
  });

  it('should remove email signatures', () => {
    const emailWithSignature = `
Hi there,

This is the main email content.

--
John Doe
CEO, Example Corp
john@example.com
`;

    const cleaned = cleanEmailContent(emailWithSignature);
    expect(cleaned).toBe("Hi there,\n\nThis is the main email content.");
  });

  it('should handle empty or invalid input', () => {
    expect(cleanEmailContent('')).toBe('');
    expect(cleanEmailContent(null as any)).toBe('');
    expect(cleanEmailContent(undefined as any)).toBe('');
  });

  it('should handle the specific forwarded email from user attachment', () => {
    const userForwardedEmail = `
Message Body

Return-Path: <user@example.com>
Received: from mail-yw1-f174.google.com (mail-yw1-f174.google.com [209.85.128.174])
by inbound.smtp.us-east-1.amazonaws.com with SMTP id nf6oqnAVkbDr7mBdmct3kqH4nnvO81
for hello@example.dev;
Sun, 14 Sep 2025 17:44:15 +0000 (UTC)

---------- Forwarded message ----------
From: John Smith <john@example.com>
Date: Fri, Sep 12, 2025 at 2:17+E2+80+AFPM
Subject: Scaling start up - Extending their Full Stack Engineering team.
To: <user@example.com>

Hi David

I=E2=80=99m reaching out about an exciting Full Stack Engineer opportunity =
with a
fast-growing Series B SaaS company. They=E2=80=99s scaling quickly and inve=
sting
heavily into their engineering practice, having doubled the headcount size
in the last month alone.

Here=E2=80=99s what=E2=80=99s on offer:

- **Where:** Remote based role
- **Package:** Up to $200k base salary + meaningful equity, unlimited PTO
and more
- **Tech Stack:** TypeScript, React, Node.js, AWS, Postgres

The work is focused on addressing major inefficiencies in the construction
industry =E2=80=94 giving you the chance to build solutions with real-world=
s
impact.

Would you be open to a quick chat to explore this role further? If =E2=80=
=99s not
quite what you=E2=80=99re looking for, I=E2=80=99d still love to hear what=
=E2=80=99s next on your
radar so I can keep you in mind for future opportunities.

[Image: Planet Shine]

*John Smith*
Senior Recruiter, *Example Corp*

AI/ML & Software Recruitment Specialist
+1 646-298-3569 • 15464293569•
www.example.com

This email was sent to user@example.com by John Smith.
To remove your email address permanently from future mailings, please click
here.
`;

    const cleaned = cleanEmailContent(userForwardedEmail);
    expect(cleaned).toBe("Hi David\n\nI=E2m reaching out about an exciting Full Stack Engineer opportunity with a\nfast-growing Series B SaaS company. They=E2s scaling quickly and investing\nheavily into their engineering practice, having doubled the headcount size\nin the last month alone.\n\nHere=E2s what=E2s on offer:\n\n- **Where:** Remote based role\n- **Package:** Up to $200k base salary + meaningful equity, unlimited PTO\nand more\n- **Tech Stack:** TypeScript, React, Node.js, AWS, Postgres\n\nThe work is focused on addressing major inefficiencies in the construction\nindustry =E2 giving you the chance to build solutions with real-worlds\nimpact.\n\nWould you be open to a quick chat to explore this role further? If =E2s not\nquite what you=E2re looking for, I=E2d still love to hear what=E2s next on your\nradar so I can keep you in mind for future opportunities.\n\n[Image: Planet Shine]\n\n*John Smith*\nSenior Recruiter, *Example Corp*\n\nAI/ML & Software Recruitment Specialist\n+1 646-298-3569 • 15464293569•\nwww.example.com");
  });
});
