import nodemailer from 'nodemailer';
import fs from 'fs';
import { logger } from '../utils/logger.js';

// OTP codes, verification links and reset links must never be persisted to disk or
// stdout outside of local development — they're valid credentials until they expire.
const isDev = (process.env.NODE_ENV || 'development') !== 'production';

// ─── Translated email copy ─────────────────────────────────────────────────
// Only email is used for OTP delivery — there is no SMS gateway integrated.
const EMAIL_STRINGS = {
  fr: {
    tagline: 'Enchères Agricoles',
    roleLabels: { buyer: 'Acheteur', producer: 'Producteur' },
    footerNote: "Cet e-mail automatique a été envoyé à l'adresse fournie lors de l'inscription.",
    footerCopyright: (year) => `© ${year} Sougra — Plateforme d'Enchères Inversées Agricoles en Algérie`,
    verify: {
      subject: '✅ Confirmez votre adresse email — Sougra',
      title: 'Confirmez votre email — Sougra',
      greeting: (name) => `Bonjour, ${name} 👋`,
      body: `Merci de vous être inscrit sur la plateforme <strong style="color:#ffffff;">Sougra</strong>. Pour activer votre compte et accéder aux enchères agricoles, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous.`,
      button: '✅ Confirmer mon email',
      expiry: `Ce lien expire dans <strong>24 heures</strong>. Si vous n'avez pas créé de compte sur notre plateforme, vous pouvez ignorer cet e-mail en toute sécurité.`,
      fallback: "Si le bouton ne fonctionne pas, copiez et collez l'URL suivante dans votre navigateur :",
    },
    welcome: {
      subject: '🌿 Bienvenue sur Sougra !',
      title: '🌿 Bienvenue sur Sougra !',
      greeting: (name) => `Bienvenue sur Sougra, ${name} ! 🎉`,
      body1: (roleLabel) => `Votre compte en tant que <strong style="color:#ffffff;">${roleLabel}</strong> est désormais validé et actif. Vous pouvez dès maintenant vous connecter pour participer aux enchères inversées agricoles en Algérie.`,
      body2: `Découvrez les offres en cours, créez vos appels d'offres ou proposez vos meilleurs produits de qualité supérieure.`,
      button: 'Accéder à la plateforme',
    },
    otpCommon: {
      greeting: (name) => `Bonjour ${name},`,
      validity: (minutes) => `Ce code de sécurité à usage unique est valide pendant <strong>${minutes} minutes</strong>. Pour la sécurité de votre compte, ne partagez jamais ce code.`,
    },
    otp: {
      login: { subject: 'Double authentification - Sougra', title: 'Code de connexion', desc: 'Utilisez le code de connexion ci-dessous pour confirmer votre accès.' },
      login_resend: { subject: 'Double authentification - Sougra (Renvoyé)', title: 'Code de connexion', desc: 'Utilisez le nouveau code de connexion ci-dessous pour confirmer votre accès.' },
      password_change: { subject: 'Code de confirmation - Changement de mot de passe', title: 'Changement de mot de passe', desc: 'Utilisez le code ci-dessous pour confirmer votre demande de changement de mot de passe.' },
    },
    deactivation: {
      subject: 'ℹ️ Confirmation de désactivation de votre compte — Sougra',
      title: 'Compte désactivé 👋',
      greeting: (name) => `Bonjour ${name},`,
      body1: 'Votre compte sur la plateforme Sougra a bien été désactivé à votre demande ou conformément à nos conditions générales.',
      body2: 'Si vous souhaitez réactiver votre compte ou si vous pensez qu\'il s\'agit d\'une erreur, veuillez contacter notre équipe support.',
      button: '📧 Contacter le support',
    },
    passwordReset: {
      subject: '🔑 Réinitialisation de votre mot de passe — Sougra',
      title: 'Demande de réinitialisation de mot de passe',
      greeting: (name) => `Bonjour ${name},`,
      body: 'Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte Sougra. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.',
      button: '🔑 Choisir un nouveau mot de passe',
      expiry: `Ce lien expire dans <strong>1 heure</strong>. Si vous n'avez pas demandé ce changement, vous pouvez ignorer cet e-mail en toute sécurité.`,
      fallback: "Si le bouton ne fonctionne pas, copiez et collez l'URL suivante dans votre navigateur :",
    },
  },
  en: {
    tagline: 'Agricultural Auctions',
    roleLabels: { buyer: 'Buyer', producer: 'Producer' },
    footerNote: 'This automated email was sent to the address provided at registration.',
    footerCopyright: (year) => `© ${year} Sougra — Algeria's Reverse Agricultural Auction Platform`,
    verify: {
      subject: '✅ Confirm your email address — Sougra',
      title: 'Confirm your email — Sougra',
      greeting: (name) => `Hello, ${name} 👋`,
      body: `Thank you for signing up on the <strong style="color:#ffffff;">Sougra</strong> platform. To activate your account and access agricultural auctions, please confirm your email address by clicking the button below.`,
      button: '✅ Confirm my email',
      expiry: `This link expires in <strong>24 hours</strong>. If you did not create an account on our platform, you can safely ignore this email.`,
      fallback: 'If the button does not work, copy and paste the following URL into your browser:',
    },
    welcome: {
      subject: '🌿 Welcome to Sougra!',
      title: '🌿 Welcome to Sougra!',
      greeting: (name) => `Welcome to Sougra, ${name}! 🎉`,
      body1: (roleLabel) => `Your account as a <strong style="color:#ffffff;">${roleLabel}</strong> is now validated and active. You can now log in to take part in agricultural reverse auctions in Algeria.`,
      body2: 'Explore ongoing listings, create your own requests, or offer your best premium-quality products.',
      button: 'Go to the platform',
    },
    otpCommon: {
      greeting: (name) => `Hello ${name},`,
      validity: (minutes) => `This one-time security code is valid for <strong>${minutes} minutes</strong>. For your account's security, never share this code.`,
    },
    otp: {
      login: { subject: 'Two-Factor Authentication - Sougra', title: 'Login code', desc: 'Use the login code below to confirm your access.' },
      login_resend: { subject: 'Two-Factor Authentication - Sougra (Resent)', title: 'Login code', desc: 'Use the new login code below to confirm your access.' },
      password_change: { subject: 'Confirmation Code - Password Change', title: 'Password change', desc: 'Use the code below to confirm your password change request.' },
    },
    deactivation: {
      subject: 'ℹ️ Account Deactivation Confirmation — Sougra',
      title: 'Account deactivated 👋',
      greeting: (name) => `Hello ${name},`,
      body1: 'Your Sougra account has been deactivated at your request or in accordance with our terms of service.',
      body2: 'If you wish to reactivate your account, or believe this is an error, please contact our support team.',
      button: '📧 Contact support',
    },
    passwordReset: {
      subject: '🔑 Password Reset — Sougra',
      title: 'Password reset request',
      greeting: (name) => `Hello ${name},`,
      body: 'We received a request to reset the password for your Sougra account. Click the button below to choose a new password.',
      button: '🔑 Choose a new password',
      expiry: `This link expires in <strong>1 hour</strong>. If you did not request this change, you can safely ignore this email.`,
      fallback: 'If the button does not work, copy and paste the following URL into your browser:',
    },
  },
  ar: {
    tagline: 'مزادات زراعية',
    roleLabels: { buyer: 'مشتري', producer: 'منتج' },
    footerNote: 'تم إرسال هذا البريد الإلكتروني الآلي إلى العنوان الذي قدمته عند التسجيل.',
    footerCopyright: (year) => `© ${year} سوقرة — منصة المزادات العكسية الزراعية في الجزائر`,
    verify: {
      subject: '✅ أكد عنوان بريدك الإلكتروني — سوقرة',
      title: 'أكد بريدك الإلكتروني — سوقرة',
      greeting: (name) => `مرحبًا، ${name} 👋`,
      body: `شكرًا لتسجيلك في منصة <strong style="color:#ffffff;">سوقرة</strong>. لتفعيل حسابك والوصول إلى المزادات الزراعية، يرجى تأكيد عنوان بريدك الإلكتروني بالنقر على الزر أدناه.`,
      button: '✅ تأكيد بريدي الإلكتروني',
      expiry: `تنتهي صلاحية هذا الرابط خلال <strong>24 ساعة</strong>. إذا لم تقم بإنشاء حساب على منصتنا، يمكنك تجاهل هذا البريد الإلكتروني بأمان.`,
      fallback: 'إذا لم يعمل الزر، انسخ الرابط التالي والصقه في متصفحك:',
    },
    welcome: {
      subject: '🌿 مرحبًا بك في سوقرة!',
      title: '🌿 مرحبًا بك في سوقرة!',
      greeting: (name) => `مرحبًا بك في سوقرة، ${name}! 🎉`,
      body1: (roleLabel) => `تم الآن التحقق من حسابك كـ<strong style="color:#ffffff;">${roleLabel}</strong> وهو نشط. يمكنك الآن تسجيل الدخول للمشاركة في المزادات العكسية الزراعية في الجزائر.`,
      body2: 'اكتشف العروض الجارية، أنشئ طلباتك الخاصة، أو اعرض أفضل منتجاتك ذات الجودة العالية.',
      button: 'الذهاب إلى المنصة',
    },
    otpCommon: {
      greeting: (name) => `مرحبًا ${name}،`,
      validity: (minutes) => `رمز الأمان لمرة واحدة هذا صالح لمدة <strong>${minutes} دقائق</strong>. لأمان حسابك، لا تشارك هذا الرمز أبدًا مع أي شخص.`,
    },
    otp: {
      login: { subject: 'التحقق الثنائي - سوقرة', title: 'رمز تسجيل الدخول', desc: 'استخدم رمز تسجيل الدخول أدناه لتأكيد وصولك.' },
      login_resend: { subject: 'التحقق الثنائي - سوقرة (تم إعادة الإرسال)', title: 'رمز تسجيل الدخول', desc: 'استخدم رمز تسجيل الدخول الجديد أدناه لتأكيد وصولك.' },
      password_change: { subject: 'رمز التأكيد - تغيير كلمة المرور', title: 'تغيير كلمة المرور', desc: 'استخدم الرمز أدناه لتأكيد طلب تغيير كلمة المرور.' },
    },
    deactivation: {
      subject: 'ℹ️ تأكيد إلغاء تفعيل حسابك — سوقرة',
      title: 'تم إلغاء تفعيل الحساب 👋',
      greeting: (name) => `مرحبًا ${name}،`,
      body1: 'تم إلغاء تفعيل حسابك على منصة سوقرة بناءً على طلبك أو وفقًا لشروط استخدامنا.',
      body2: 'إذا كنت ترغب في إعادة تفعيل حسابك، أو تعتقد أن هذا خطأ، يرجى التواصل مع فريق الدعم لدينا.',
      button: '📧 التواصل مع الدعم',
    },
    passwordReset: {
      subject: '🔑 إعادة تعيين كلمة المرور — سوقرة',
      title: 'طلب إعادة تعيين كلمة المرور',
      greeting: (name) => `مرحبًا ${name}،`,
      body: 'تلقينا طلبًا لإعادة تعيين كلمة المرور لحسابك على سوقرة. انقر على الزر أدناه لاختيار كلمة مرور جديدة.',
      button: '🔑 اختيار كلمة مرور جديدة',
      expiry: `تنتهي صلاحية هذا الرابط خلال <strong>ساعة واحدة</strong>. إذا لم تطلب هذا التغيير، يمكنك تجاهل هذا البريد الإلكتروني بأمان.`,
      fallback: 'إذا لم يعمل الزر، انسخ الرابط التالي والصقه في متصفحك:',
    },
  },
};

function strings(locale) {
  return EMAIL_STRINGS[locale] || EMAIL_STRINGS.fr;
}

function getFromAddress() {
  const address = process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME || process.env.EMAIL_USER || 'support@sougra.com';
  const name = process.env.MAIL_FROM_NAME || 'Sougra';
  return `"${name}" <${address}>`;
}

let testTransporter = null;
let testAccountInfo = null;

// Brevo's HTTP API (port 443) is used instead of raw SMTP when configured —
// several free hosting platforms (e.g. Render's free tier) block outbound
// SMTP ports entirely, which makes nodemailer's SMTP transport time out
// even with correct credentials. HTTPS to an email API is never blocked.
function createBrevoTransporter(apiKey) {
  return {
    sendMail: async ({ from, to, subject, html, replyTo }) => {
      const fromMatch = /^"?(.*?)"?\s*<(.+)>$/.exec(from) || [];
      const senderName = fromMatch[1] || process.env.MAIL_FROM_NAME || 'Sougra';
      const senderEmail = fromMatch[2] || process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME;

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          ...(replyTo ? { replyTo: { email: replyTo } } : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Brevo API error ${res.status}: ${body}`);
      }
      return {};
    },
  };
}

async function createTransporter() {
  const brevoApiKey = process.env.BREVO_API_KEY;
  if (brevoApiKey) {
    return createBrevoTransporter(brevoApiKey);
  }

  const host = process.env.MAIL_HOST || process.env.EMAIL_HOST;
  const port = parseInt(process.env.MAIL_PORT || process.env.EMAIL_PORT || '587', 10);
  const user = process.env.MAIL_USERNAME || process.env.EMAIL_USER;
  const pass = process.env.MAIL_PASSWORD || process.env.EMAIL_PASS;
  const encryption = (process.env.MAIL_ENCRYPTION || '').toLowerCase();

  if (host && user && pass) {
    const isSecure = port === 465 || encryption === 'ssl';
    return nodemailer.createTransport({
      host,
      port,
      secure: isSecure,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  if (testTransporter) {
    return testTransporter;
  }

  try {
    const account = await nodemailer.createTestAccount();
    testAccountInfo = account;
    const transporter = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    testTransporter = transporter;
    console.warn('[EMAIL] SMTP credentials not configured. Using Ethereal test account for development.');
    console.log(`[EMAIL] Ethereal preview available after sending messages.`);
    return transporter;
  } catch (err) {
    console.warn('[EMAIL] SMTP credentials not configured and Ethereal account creation failed. Emails will not be sent.', err.message);
    return null;
  }
}

// Common template wrapper for brand consistency
function getBaseTemplate(title, bodyContent, locale = 'fr') {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const c = strings(locale);
  return `
    <!DOCTYPE html>
    <html lang="${locale}" dir="${dir}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body dir="${dir}" style="margin:0;padding:0;background-color:#0b0f12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <table cellpadding="0" cellspacing="0" width="100%" style="background-color:#0b0f12;min-height:100vh;padding:40px 20px;">
        <tr>
          <td align="center" valign="top">
            <table cellpadding="0" cellspacing="0" width="100%" style="max-width:540px;background-color:#121a20;border:1px solid #1e293b;border-radius:24px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.4);">

              <!-- Header -->
              <tr>
                <td style="padding:48px 32px 32px 32px;text-align:center;border-bottom:1px solid #1e293b;">
                  <div style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);width:64px;height:64px;border-radius:20px;margin-bottom:16px;box-shadow:0 8px 24px rgba(16,185,129,0.25);text-align:center;line-height:64px;">
                    <span style="font-size:32px;vertical-align:middle;display:inline-block;line-height:64px;">🌿</span>
                  </div>
                  <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:800;letter-spacing:-0.02em;">Sougra</h1>
                  <p style="color:#10b981;margin:4px 0 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;">${c.tagline}</p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td dir="${dir}" style="padding:40px 32px;color:#f3f4f6;font-size:15px;line-height:1.6;">
                  ${bodyContent}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color:#0e1419;padding:24px 32px;text-align:center;border-top:1px solid #1e293b;">
                  <p style="color:#4b5563;font-size:12px;line-height:1.6;margin:0;">
                    ${c.footerCopyright(new Date().getFullYear())}
                  </p>
                  <p style="color:#374151;font-size:11px;margin:8px 0 0 0;">
                    ${c.footerNote}
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export async function sendVerificationEmail(to, name, token, locale = 'fr') {
  const transporter = await createTransporter();
  const APP_URL = process.env.APP_URL || 'http://localhost:5173';
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
  const s = strings(locale).verify;

  // Log the link to the console/dev log for easy local verification — dev only.
  if (isDev) {
    console.log(`\n==================================================`);
    console.log(`[EMAIL DEV] Verification link for ${to}:`);
    console.log(`👉 ${verifyUrl}`);
    console.log(`==================================================\n`);

    try {
      fs.appendFileSync('email_dev.log', `[${new Date().toISOString()}] VERIFY for ${to}: ${verifyUrl}\n`);
    } catch (err) {
      logger.error({ err }, 'Failed to write dev email log');
    }
  }

  if (!transporter) {
    return; // Silently skip in dev when not configured
  }

  const html = getBaseTemplate(
    s.title,
    `
      <h2 style="color:#f3f4f6;font-size:20px;margin:0 0 16px 0;font-weight:700;">${s.greeting(name)}</h2>
      <p style="color:#9ca3af;line-height:1.7;margin:0 0 32px 0;">
        ${s.body}
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="${verifyUrl}"
           style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:700;font-size:16px;letter-spacing:0.01em;box-shadow:0 6px 20px rgba(16,185,129,0.3);transition:all 0.2s ease;">
          ${s.button}
        </a>
      </div>

      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:32px 0 16px 0;border-top:1px solid #1e293b;padding-top:20px;">
        ${s.expiry}
      </p>

      <div style="background-color:#17222a;border:1px solid #23323e;border-radius:12px;padding:16px;margin-top:24px;">
        <p style="color:#4b5563;font-size:11px;margin:0;line-height:1.5;word-break:break-all;">
          ${s.fallback}<br>
          <a href="${verifyUrl}" style="color:#10b981;text-decoration:none;">${verifyUrl}</a>
        </p>
      </div>
    `,
    locale
  );

  try {
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject: s.subject,
      html,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`[EMAIL] Verification email preview: ${previewUrl}`);
  } catch (err) {
    logger.error({ err }, 'EMAIL: Failed to send verification email via SMTP');
  }
}

export async function sendWelcomeEmail(to, name, role, locale = 'fr') {
  const transporter = await createTransporter();
  if (!transporter) {
    console.log(`[EMAIL DEV] Welcome email would be sent to ${to}`);
    return;
  }

  const s = strings(locale).welcome;
  const roleLabel = strings(locale).roleLabels[role] || strings(locale).roleLabels.producer;

  const html = getBaseTemplate(
    s.title,
    `
      <h2 style="color:#f3f4f6;font-size:20px;margin:0 0 16px 0;font-weight:700;">${s.greeting(name)}</h2>
      <p style="color:#9ca3af;line-height:1.7;margin:0 0 24px 0;">
        ${s.body1(roleLabel)}
      </p>
      <p style="color:#9ca3af;line-height:1.7;margin:0 0 32px 0;">
        ${s.body2}
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="${process.env.APP_URL || 'http://localhost:5173'}"
           style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:700;font-size:16px;box-shadow:0 6px 20px rgba(16,185,129,0.3);">
          ${s.button}
        </a>
      </div>
    `,
    locale
  );

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject: s.subject,
      html,
    });
  } catch (err) {
    logger.error({ err }, 'EMAIL: Failed to send welcome email via SMTP');
  }
}

// `type` selects the copy variant: 'login', 'login_resend' or 'password_change'.
export async function sendOtpEmail(to, name, otp, minutes, type, locale = 'fr') {
  const transporter = await createTransporter();
  if (isDev) {
    console.log(`\n==================================================`);
    console.log(`[EMAIL DEV] OTP Code for ${to} (${name}):`);
    console.log(`👉 ${otp} (Expires in ${minutes} minutes)`);
    console.log(`==================================================\n`);

    try {
      fs.appendFileSync('email_dev.log', `[${new Date().toISOString()}] OTP for ${to}: ${otp}\n`);
    } catch (err) {
      logger.error({ err }, 'Failed to write dev OTP log');
    }
  }

  if (!transporter) {
    return; // Silently skip in dev when not configured
  }

  const localeStrings = strings(locale);
  const s = localeStrings.otp[type] || localeStrings.otp.login;
  const common = localeStrings.otpCommon;

  const html = getBaseTemplate(
    s.subject,
    `
      <h2 style="color:#f3f4f6;font-size:20px;margin:0 0 16px 0;font-weight:700;">${s.title}</h2>
      <p style="color:#9ca3af;line-height:1.6;margin:0 0 24px 0;">${common.greeting(name)}</p>
      <p style="color:#9ca3af;line-height:1.6;margin:0 0 32px 0;">${s.desc}</p>

      <div style="text-align:center;margin:36px 0;">
        <span style="display:inline-block;background:#17222a;color:#10b981;padding:16px 32px;font-size:28px;font-weight:800;letter-spacing:8px;border-radius:14px;border:1px solid #10b981;box-shadow:0 4px 12px rgba(16,185,129,0.1);">
          ${otp}
        </span>
      </div>

      <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:32px 0 0 0;border-top:1px solid #1e293b;padding-top:20px;">
        ${common.validity(minutes)}
      </p>
    `,
    locale
  );

  try {
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject: s.subject,
      html,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`[EMAIL] OTP email preview: ${previewUrl}`);
  } catch (err) {
    logger.error({ err }, 'EMAIL: Failed to send OTP email via SMTP');
  }
}

export async function sendAccountDeactivationEmail(to, name, locale = 'fr') {
  const transporter = await createTransporter();
  if (!transporter) {
    console.log(`[EMAIL DEV] Deactivation confirmation email would be sent to ${to}`);
    return;
  }

  const s = strings(locale).deactivation;

  const html = getBaseTemplate(
    s.subject,
    `
      <h2 style="color:#f59e0b;font-size:20px;margin:0 0 16px 0;font-weight:700;">${s.title}</h2>
      <p style="color:#9ca3af;line-height:1.6;margin:0 0 20px 0;">${s.greeting(name)}</p>
      <p style="color:#9ca3af;line-height:1.6;margin:0 0 24px 0;">
        ${s.body1}
      </p>
      <p style="color:#9ca3af;line-height:1.6;margin:0 0 32px 0;">
        ${s.body2}
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="mailto:support@sougra.com"
           style="display:inline-block;background:#f59e0b;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:15px;box-shadow:0 6px 20px rgba(245,158,11,0.2);">
          ${s.button}
        </a>
      </div>
    `,
    locale
  );

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject: s.subject,
      html,
    });
  } catch (err) {
    logger.error({ err }, 'EMAIL: Failed to send deactivation email via SMTP');
  }
}

export async function sendPasswordResetEmail(to, name, token, locale = 'fr') {
  const transporter = await createTransporter();
  const APP_URL = process.env.APP_URL || 'http://localhost:5173';
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const s = strings(locale).passwordReset;

  if (isDev) {
    console.log(`\n==================================================`);
    console.log(`[EMAIL DEV] Password reset link for ${to}:`);
    console.log(`👉 ${resetUrl}`);
    console.log(`==================================================\n`);

    try {
      fs.appendFileSync('email_dev.log', `[${new Date().toISOString()}] RESET PASSWORD for ${to}: ${resetUrl}\n`);
    } catch (err) {}
  }

  if (!transporter) return;

  const html = getBaseTemplate(
    s.subject,
    `
      <h2 style="color:#f3f4f6;font-size:20px;margin:0 0 16px 0;font-weight:700;">${s.title}</h2>
      <p style="color:#9ca3af;line-height:1.6;margin:0 0 20px 0;">${s.greeting(name)}</p>
      <p style="color:#9ca3af;line-height:1.6;margin:0 0 32px 0;">
        ${s.body}
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="${resetUrl}"
           style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:700;font-size:16px;box-shadow:0 6px 20px rgba(16,185,129,0.3);">
          ${s.button}
        </a>
      </div>

      <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:32px 0 16px 0;border-top:1px solid #1e293b;padding-top:20px;">
        ${s.expiry}
      </p>

      <div style="background-color:#17222a;border:1px solid #23323e;border-radius:12px;padding:16px;margin-top:24px;">
        <p style="color:#4b5563;font-size:11px;margin:0;line-height:1.5;word-break:break-all;">
          ${s.fallback}<br>
          <a href="${resetUrl}" style="color:#10b981;text-decoration:none;">${resetUrl}</a>
        </p>
      </div>
    `,
    locale
  );

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject: s.subject,
      html,
    });
  } catch (err) {
    logger.error({ err }, 'EMAIL: Failed to send password reset email via SMTP');
  }
}

const SUPPORT_ADDRESS = process.env.SUPPORT_EMAIL || 'achikh200@gmail.com';

// Sends a user's help-page message to the support inbox, with Reply-To set to the
// user so the support team can answer directly. Unlike the other send* functions,
// this one THROWS on failure — the caller needs to know the message truly went out.
export async function sendSupportMessage(name, fromEmail, subject, message, locale = 'fr') {
  const transporter = await createTransporter();

  if (isDev) {
    console.log(`\n==================================================`);
    console.log(`[SUPPORT DEV] Message from ${name} <${fromEmail}> (app locale: ${locale}):`);
    console.log(`Subject: ${subject}`);
    console.log(message);
    console.log(`==================================================\n`);
  }

  if (!transporter) {
    throw new Error('Email transport unavailable');
  }

  const safeMessageHtml = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const html = getBaseTemplate(
    'Nouveau message support — Sougra',
    `
      <h2 style="color:#f3f4f6;font-size:20px;margin:0 0 16px 0;font-weight:700;">📩 Nouveau message de support</h2>
      <p style="color:#9ca3af;line-height:1.6;margin:0 0 8px 0;"><strong style="color:#ffffff;">De :</strong> ${name} (${fromEmail})</p>
      <p style="color:#9ca3af;line-height:1.6;margin:0 0 8px 0;"><strong style="color:#ffffff;">Langue de l'application :</strong> ${locale}</p>
      <p style="color:#9ca3af;line-height:1.6;margin:0 0 24px 0;"><strong style="color:#ffffff;">Sujet :</strong> ${subject}</p>
      <div style="background-color:#17222a;border:1px solid #23323e;border-radius:12px;padding:20px;color:#f3f4f6;line-height:1.7;">
        ${safeMessageHtml}
      </div>
    `,
    'fr'
  );

  await transporter.sendMail({
    from: getFromAddress(),
    to: SUPPORT_ADDRESS,
    replyTo: fromEmail,
    subject: `[Support Sougra] ${subject}`,
    html,
  });
}
