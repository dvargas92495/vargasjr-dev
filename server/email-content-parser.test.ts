import { describe, it, expect } from "vitest";
import { parseEmailBody } from "./email-content-parser";

describe("parseEmailBody", () => {
  it("should handle forwarded emails with Gmail format", () => {
    const forwardedEmail = `
Return-Path: <sender@example.com>
Received: from mail.example.com
Date: Mon, 1 Jan 2024 12:00:00 +0000

---------- Forwarded message ----------
From: Test User <testuser@example.com>
Date: Mon, 1 Jan 2024 at 11:00 AM
Subject: Test Subject
To: recipient@example.com

Hi there,

This is the actual email content that should be preserved.

Best regards,
Test User
`;

    const cleaned = parseEmailBody(forwardedEmail);
    expect(cleaned).toBe(
      "Hi there,\n\nThis is the actual email content that should be preserved.\n\nBest regards,\nTest User"
    );
  });

  it("should handle HTML emails", () => {
    const htmlEmail = `
<html>
<body>
<p>Hello World</p>
<p>This is an HTML email.</p>
</body>
</html>
`;

    const cleaned = parseEmailBody(htmlEmail);
    expect(cleaned).toBe("Hello World\nThis is an HTML email.");
  });

  it("should remove email signatures", () => {
    const emailWithSignature = `
Hi there,

This is the main email content.

--
Test User
CEO, Example Corp
testuser@example.com
`;

    const cleaned = parseEmailBody(emailWithSignature);
    expect(cleaned).toBe("Hi there,\n\nThis is the main email content.");
  });

  it("should handle empty or invalid input", () => {
    expect(parseEmailBody("")).toBe("");
    expect(parseEmailBody(null as any)).toBe("");
    expect(parseEmailBody(undefined as any)).toBe("");
  });

  it("should handle the specific forwarded email from user attachment", () => {
    const userForwardedEmail = `
Message Body

Return-Path: <user@example.com>
Received: from mail-yw1-f174.google.com (mail-yw1-f174.google.com [209.85.128.174])
by inbound.smtp.us-east-1.amazonaws.com with SMTP id nf6oqnAVkbDr7mBdmct3kqH4nnvO81
for hello@example.dev;
Sun, 14 Sep 2025 17:44:15 +0000 (UTC)

---------- Forwarded message ----------
From: Test Recruiter <recruiter@example.com>
Date: Fri, Sep 12, 2025 at 2:17+E2+80+AFPM
Subject: Scaling start up - Extending their Full Stack Engineering team.
To: <user@example.com>

Hi Test User

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

*Test Recruiter*
Senior Recruiter, *Example Corp*

AI/ML & Software Recruitment Specialist
+1 646-298-3569 • 15464293569•
www.example.com

This email was sent to user@example.com by Test Recruiter.
To remove your email address permanently from future mailings, please click
here.
`;

    const cleaned = parseEmailBody(userForwardedEmail);
    expect(cleaned).toBe(
      "Hi Test User\n\nI=E2m reaching out about an exciting Full Stack Engineer opportunity with a\nfast-growing Series B SaaS company. They=E2s scaling quickly and investing\nheavily into their engineering practice, having doubled the headcount size\nin the last month alone.\n\nHere=E2s what=E2s on offer:\n\n- **Where:** Remote based role\n- **Package:** Up to $200k base salary + meaningful equity, unlimited PTO\nand more\n- **Tech Stack:** TypeScript, React, Node.js, AWS, Postgres\n\nThe work is focused on addressing major inefficiencies in the construction\nindustry =E2 giving you the chance to build solutions with real-worlds\nimpact.\n\nWould you be open to a quick chat to explore this role further? If =E2s not\nquite what you=E2re looking for, I=E2d still love to hear what=E2s next on your\nradar so I can keep you in mind for future opportunities.\n\n[Image: Planet Shine]\n\n*Test Recruiter*\nSenior Recruiter, *Example Corp*\n\nAI/ML & Software Recruitment Specialist\n+1 646-298-3569 • 15464293569•\nwww.example.com"
    );
  });

  describe("parseEmailBody MIME parsing", () => {
    it("should extract text/plain content from multipart email", () => {
      const multipartEmail = `Content-Type: multipart/alternative; boundary="boundary123"

--boundary123
Content-Type: text/plain; charset="UTF-8"

Apply to this job for me

---------- Forwarded message ---------
From: Test Recruiter <recruiter@example.com>
Date: Fri, Sep 12, 2025 at 2:17 PM
Subject: Scaling start up - Expanding their Full Stack Engineering team.
To: <user@example.com>

Hi Test User
I'm reaching out about an exciting Full Stack Engineer opportunity.
--boundary123
Content-Type: text/html; charset="UTF-8"

<p>Apply to this job for me</p>
<p>HTML version content</p>
--boundary123--`;

      const result = parseEmailBody(multipartEmail);
      expect(result).toBe(
        "Apply to this job for me\n\n---------- Forwarded message ---------\nFrom: Test Recruiter <recruiter@example.com>\nDate: Fri, Sep 12, 2025 at 2:17 PM\nSubject: Scaling start up - Expanding their Full Stack Engineering team.\nTo: <user@example.com>\n\nHi Test User\nI'm reaching out about an exciting Full Stack Engineer opportunity."
      );
    });

    it("should decode quoted-printable encoding", () => {
      const quotedPrintableEmail = `Content-Type: multipart/alternative; boundary="boundary123"

--boundary123
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

I=E2=80=99m reaching out about an exciting opportunity=
with a fast-growing company. They=E2=80=99re scaling quickly.
--boundary123--`;

      const result = parseEmailBody(quotedPrintableEmail);
      expect(result).toBe(
        "I’m reaching out about an exciting opportunitywith a fast-growing company. They’re scaling quickly."
      );
    });

    it("should handle non-multipart emails", () => {
      const simpleEmail = "Simple email content";
      const result = parseEmailBody(simpleEmail);
      expect(result).toBe("Simple email content");
    });

    it("should fallback to HTML when no text/plain available", () => {
      const htmlOnlyEmail = `Content-Type: multipart/alternative; boundary="boundary123"

--boundary123
Content-Type: text/html; charset="UTF-8"

<p>HTML only content</p>
--boundary123--`;

      const result = parseEmailBody(htmlOnlyEmail);
      expect(result).toBe("<p>HTML only content</p>");
    });

    it("should handle complex forwarded email with quoted-printable encoding", () => {
      const userEmail = `Content-Type: multipart/alternative; boundary="000000000000940f27063ec8e887"

--000000000000940f27063ec8e887
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

Apply to this job for me

---------- Forwarded message ---------
From: Test Recruiter <recruiter@example.com>
Date: Fri, Sep 12, 2025 at 2:17=E2=80=AFPM
Subject: Scaling start up - Expanding their Full Stack Engineering team.
To: <user@example.com>


Hi Test User
I=E2=80=99m reaching out about an exciting Full Stack Engineer opportunity =
with a
fast-growing Series B SaaS company. They=E2=80=99re scaling quickly and inv=
esting
heavily into their engineering practice, having doubled the headcount size
in the last month alone.
Here=E2=80=99s a snapshot of what=E2=80=99s on offer:

   - *Where:* Remote based role
   - *Package:* Up to $220k base salary + meaningful equity, unlimited PTO
   and more
   - *Tech Stack:* TypeScript, React, Node.js, AWS, Postgres

The work is focused on addressing major inefficiencies in the construction
industry =E2=80=94 giving you the chance to build solutions with real-world=
 impact.
Would you be open to a quick chat to explore this role further? If it=E2=80=
=99s not
quite what you=E2=80=99re looking for, I=E2=80=99d still love to hear what=
=E2=80=99s next on your
radar so I can keep you in mind for future opportunities.
--000000000000940f27063ec8e887
Content-Type: text/html; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

<div dir=3D"ltr">Apply to this job for me<br><br><div class=3D"gmail_quote =
gmail_quote_container"><div dir=3D"ltr" class=3D"gmail_attr">---------- For=
warded message ---------<br>From: <strong class=3D"gmail_sendername" dir=3D=
"auto">Test Recruiter</strong> <span dir=3D"auto">&lt;<a href=3D"mailto:john=
@example.com">recruiter@example.com</a>&gt;</span><br>Date: Fri, Sep 12=
, 2025 at 2:17=E2=80=AFPM<br>Subject: Scaling start up - Expanding their Ful=
l Stack Engineering team.<br>To:  &lt;<a href=3D"mailto:user@example.=
com">user@example.com</a>&gt;<br></div><br><br>
--000000000000940f27063ec8e887--`;

      const result = parseEmailBody(userEmail);
      expect(result).toBe(
        "Apply to this job for me\n\n---------- Forwarded message ---------\nFrom: Test Recruiter <recruiter@example.com>\nDate: Fri, Sep 12, 2025 at 2:17 PM\nSubject: Scaling start up - Expanding their Full Stack Engineering team.\nTo: <user@example.com>\n\nHi Test User\nI’m reaching out about an exciting Full Stack Engineer opportunity with a\nfast-growing Series B SaaS company. They’re scaling quickly and investing\nheavily into their engineering practice, having doubled the headcount size\nin the last month alone.\nHere’s a snapshot of what’s on offer:\n\n   - *Where:* Remote based role\n   - *Package:* Up to $220k base salary + meaningful equity, unlimited PTO\n   and more\n   - *Tech Stack:* TypeScript, React, Node.js, AWS, Postgres\n\nThe work is focused on addressing major inefficiencies in the construction\nindustry — giving you the chance to build solutions with real-world impact.\nWould you be open to a quick chat to explore this role further? If it’s not\nquite what you’re looking for, I’d still love to hear what’s next on your\nradar so I can keep you in mind for future opportunities."
      );
    });
  });
});
