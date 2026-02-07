export type EduDashProEmailOptions = {
  title: string;
  preheader?: string;
  subtitle?: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  secondaryCta?: { label: string; url: string };
  footerNote?: string;
  supportEmail?: string;
  logoUrl?: string;
  brandName?: string;
  year?: number;
};

export function renderEduDashProEmail(options: EduDashProEmailOptions): string {
  const {
    title,
    preheader,
    subtitle,
    bodyHtml,
    cta,
    secondaryCta,
    footerNote,
    supportEmail = "support@edudashpro.org.za",
    logoUrl,
    brandName = "EduDash Pro",
    year = new Date().getFullYear(),
  } = options;

  const preheaderText = preheader || title;
  const subtitleHtml = subtitle
    ? `<p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.6;">${subtitle}</p>`
    : "";
  const ctaHtml = cta
    ? `<div style="padding: 8px 0 4px 0;">
        <a href="${cta.url}" class="cta-button" style="display: inline-block; background: #6d28d9; color: #ffffff; text-decoration: none; padding: 14px 22px; border-radius: 12px; font-weight: 700; font-size: 14px;">
          ${cta.label}
        </a>
      </div>`
    : "";
  const secondaryCtaHtml = secondaryCta
    ? `<div style="padding-top: 6px;">
        <a href="${secondaryCta.url}" style="color: #0ea5e9; text-decoration: none; font-weight: 600; font-size: 14px;">
          ${secondaryCta.label}
        </a>
      </div>`
    : "";
  const footerHtml = footerNote
    ? `<p style="margin: 12px 0 0 0; color: #94a3b8; font-size: 12px; line-height: 1.6;">${footerNote}</p>`
    : "";

  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" width="132" alt="${brandName}" style="display: block; border: 0; outline: none; text-decoration: none; max-width: 132px;" />`
    : `<div style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 0.4px;">${brandName}</div>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${title}</title>
    <style>
      @media screen and (max-width: 640px) {
        .container { width: 100% !important; }
        .content { padding: 22px !important; }
        .header { padding: 20px 22px !important; }
        .cta-button { display: block !important; width: 100% !important; text-align: center !important; }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f1f5f9; color: #0f172a; font-family: 'Segoe UI', Inter, Arial, sans-serif;">
    <div style="display:none; font-size:1px; color:#eef2f7; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
      ${preheaderText}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9; padding: 24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" class="container" style="width: 640px; max-width: 640px; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.12);">
            <tr>
              <td class="header" style="background-color:#0b1220; background-image: linear-gradient(135deg, #0b1220 0%, #1d1346 55%, #3b1b8f 100%); padding: 26px 32px;">
                ${logoBlock}
                <div style="margin-top: 8px; color: #c7d2fe; font-size: 12px; letter-spacing: 0.8px; text-transform: uppercase;">AI‑powered education platform</div>
              </td>
            </tr>
            <tr>
              <td class="content" style="padding: 28px 32px;">
                <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 700; color: #0f172a;">${title}</h1>
                ${subtitleHtml}
                <div style="color: #334155; font-size: 15px; line-height: 1.7;">
                  ${bodyHtml}
                </div>
                ${ctaHtml}
                ${secondaryCtaHtml}
                <div style="margin-top: 24px; padding: 14px 16px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                  <p style="margin: 0; color: #475569; font-size: 13px; line-height: 1.6;">
                    Need help? Reply to this email or contact us at
                    <a href="mailto:${supportEmail}" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">${supportEmail}</a>.
                  </p>
                  ${footerHtml}
                </div>
              </td>
            </tr>
            <tr>
              <td style="background: #0f172a; padding: 16px 24px; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                  © ${year} ${brandName}. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
