import nodemailer from 'nodemailer';
import fs from 'fs';

// OTP codes, verification links and reset links must never be persisted to disk or
// stdout outside of local development — they're valid credentials until they expire.
const isDev = (process.env.NODE_ENV || 'development') !== 'production';

function getFromAddress() {
  const address = process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME || process.env.EMAIL_USER || 'support@sougra.com';
  const name = process.env.MAIL_FROM_NAME || 'Sougra';
  return `"${name}" <${address}>`;
}

let testTransporter = null;
let testAccountInfo = null;

async function createTransporter() {
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
function getBaseTemplate(title, bodyContent) {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin:0;padding:0;background-color:#0b0f12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
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
                  <p style="color:#10b981;margin:4px 0 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;">Enchères Agricoles</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding:40px 32px;color:#f3f4f6;font-size:15px;line-height:1.6;">
                  ${bodyContent}
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color:#0e1419;padding:24px 32px;text-align:center;border-top:1px solid #1e293b;">
                  <p style="color:#4b5563;font-size:12px;line-height:1.6;margin:0;">
                    © ${new Date().getFullYear()} Sougra — Plateforme d'Enchères Inversées Agricoles en Algérie
                  </p>
                  <p style="color:#374151;font-size:11px;margin:8px 0 0 0;">
                    Cet e-mail automatique a été envoyé à l'adresse fournie lors de l'inscription.
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

export async function sendVerificationEmail(to, name, token) {
  const transporter = await createTransporter();
  const APP_URL = process.env.APP_URL || 'http://localhost:5173';
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

  // Log the link to the console/dev log for easy local verification — dev only.
  if (isDev) {
    console.log(`\n==================================================`);
    console.log(`[EMAIL DEV] Verification link for ${to}:`);
    console.log(`👉 ${verifyUrl}`);
    console.log(`==================================================\n`);

    try {
      fs.appendFileSync('email_dev.log', `[${new Date().toISOString()}] VERIFY for ${to}: ${verifyUrl}\n`);
    } catch (err) {
      console.error('Failed to write dev email log:', err.message);
    }
  }

  if (!transporter) {
    return; // Silently skip in dev when not configured
  }

  const html = getBaseTemplate(
    'Confirmez votre email — Sougra',
    `
      <h2 style="color:#f3f4f6;font-size:20px;margin:0 0 16px 0;font-weight:700;">Bonjour, ${name} 👋</h2>
      <p style="color:#9ca3af;line-height:1.7;margin:0 0 32px 0;">
        Merci de vous être inscrit sur la plateforme <strong style="color:#ffffff;">Sougra</strong>. 
        Pour activer votre compte et accéder aux enchères agricoles, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous.
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="${verifyUrl}" 
           style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:700;font-size:16px;letter-spacing:0.01em;box-shadow:0 6px 20px rgba(16,185,129,0.3);transition:all 0.2s ease;">
          ✅ Confirmer mon email
        </a>
      </div>

      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:32px 0 16px 0;border-top:1px solid #1e293b;padding-top:20px;">
        Ce lien expire dans <strong>24 heures</strong>. Si vous n'avez pas créé de compte sur notre plateforme, vous pouvez ignorer cet e-mail en toute sécurité.
      </p>

      <div style="background-color:#17222a;border:1px solid #23323e;border-radius:12px;padding:16px;margin-top:24px;">
        <p style="color:#4b5563;font-size:11px;margin:0;line-height:1.5;word-break:break-all;">
          Si le bouton ne fonctionne pas, copiez et collez l'URL suivante dans votre navigateur :<br>
          <a href="${verifyUrl}" style="color:#10b981;text-decoration:none;">${verifyUrl}</a>
        </p>
      </div>
    `
  );

  try {
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject: '✅ Confirmez votre adresse email — Sougra',
      html,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`[EMAIL] Verification email preview: ${previewUrl}`);
  } catch (err) {
    console.error('[EMAIL] Failed to send verification email via SMTP:', err.message);
  }
}

export async function sendWelcomeEmail(to, name, role) {
  const transporter = await createTransporter();
  if (!transporter) {
    console.log(`[EMAIL DEV] Welcome email would be sent to ${to}`);
    return;
  }

  const roleLabel = role === 'buyer' ? 'Acheteur' : 'Producteur';
  
  const html = getBaseTemplate(
    '🌿 Bienvenue sur Sougra !',
    `
      <h2 style="color:#f3f4f6;font-size:20px;margin:0 0 16px 0;font-weight:700;">Bienvenue sur Sougra, ${name} ! 🎉</h2>
      <p style="color:#9ca3af;line-height:1.7;margin:0 0 24px 0;">
        Votre compte en tant que <strong style="color:#ffffff;">${roleLabel}</strong> est désormais validé et actif. Vous pouvez dès maintenant vous connecter pour participer aux enchères inversées agricoles en Algérie.
      </p>
      <p style="color:#9ca3af;line-height:1.7;margin:0 0 32px 0;">
        Découvrez les offres en cours, créez vos appels d'offres ou proposez vos meilleurs produits de qualité supérieure.
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="${process.env.APP_URL || 'http://localhost:5173'}" 
           style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:700;font-size:16px;box-shadow:0 6px 20px rgba(16,185,129,0.3);">
          Accéder à la plateforme
        </a>
      </div>
    `
  );

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject: '🌿 Bienvenue sur Sougra !',
      html,
    });
  } catch (err) {
    console.error('[EMAIL] Failed to send welcome email via SMTP:', err.message);
  }
}

export async function sendOtpEmail(to, name, otp, minutes, title, subject, desc) {
  const transporter = await createTransporter();
  if (isDev) {
    console.log(`\n==================================================`);
    console.log(`[EMAIL DEV] OTP Code for ${to} (${name}):`);
    console.log(`👉 ${otp} (Expires in ${minutes} minutes)`);
    console.log(`==================================================\n`);

    try {
      fs.appendFileSync('email_dev.log', `[${new Date().toISOString()}] OTP for ${to}: ${otp}\n`);
    } catch (err) {
      console.error('Failed to write dev OTP log:', err.message);
    }
  }

  if (!transporter) {
    return; // Silently skip in dev when not configured
  }

  const html = getBaseTemplate(
    subject,
    `
      <h2 style="color:#f3f4f6;font-size:20px;margin:0 0 16px 0;font-weight:700;">${title}</h2>
      <p style="color:#9ca3af;line-height:1.6;margin:0 0 24px 0;">Bonjour ${name},</p>
      <p style="color:#9ca3af;line-height:1.6;margin:0 0 32px 0;">${desc}</p>
      
      <div style="text-align:center;margin:36px 0;">
        <span style="display:inline-block;background:#17222a;color:#10b981;padding:16px 32px;font-size:28px;font-weight:800;letter-spacing:8px;border-radius:14px;border:1px solid #10b981;box-shadow:0 4px 12px rgba(16,185,129,0.1);">
          ${otp}
        </span>
      </div>
      
      <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:32px 0 0 0;border-top:1px solid #1e293b;padding-top:20px;">
        Ce code de sécurité à usage unique est valide pendant <strong>${minutes} minutes</strong>. Pour la sécurité de votre compte, ne partagez jamais ce code.
      </p>
    `
  );

  try {
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject,
      html,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`[EMAIL] OTP email preview: ${previewUrl}`);
  } catch (err) {
    console.error('[EMAIL] Failed to send OTP email via SMTP:', err.message);
  }
}

export async function sendAccountDeactivationEmail(to, name) {
  const transporter = await createTransporter();
  if (!transporter) {
    console.log(`[EMAIL DEV] Deactivation confirmation email would be sent to ${to}`);
    return;
  }

  const html = getBaseTemplate(
    'ℹ️ Confirmation de désactivation de votre compte — Sougra',
    `
      <h2 style="color:#f59e0b;font-size:20px;margin:0 0 16px 0;font-weight:700;">Compte désactivé 👋</h2>
      <p style="color:#9ca3af;line-height:1.6;margin:0 0 20px 0;">Bonjour ${name},</p>
      <p style="color:#9ca3af;line-height:1.6;margin:0 0 24px 0;">
        Votre compte sur la plateforme Sougra a bien été désactivé à votre demande ou conformément à nos conditions générales.
      </p>
      <p style="color:#9ca3af;line-height:1.6;margin:0 0 32px 0;">
        Si vous souhaitez réactiver votre compte ou si vous pensez qu'il s'agit d'une erreur, veuillez contacter notre équipe support.
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="mailto:support@sougra.com" 
           style="display:inline-block;background:#f59e0b;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:15px;box-shadow:0 6px 20px rgba(245,158,11,0.2);">
          📧 Contacter le support
        </a>
      </div>
    `
  );

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject: 'ℹ️ Confirmation de désactivation de votre compte — Sougra',
      html,
    });
  } catch (err) {
    console.error('[EMAIL] Failed to send deactivation email via SMTP:', err.message);
  }
}

export async function sendPasswordResetEmail(to, name, token) {
  const transporter = await createTransporter();
  const APP_URL = process.env.APP_URL || 'http://localhost:5173';
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

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
    '🔑 Réinitialisation de votre mot de passe — Sougra',
    `
      <h2 style="color:#f3f4f6;font-size:20px;margin:0 0 16px 0;font-weight:700;">Demande de réinitialisation de mot de passe</h2>
      <p style="color:#9ca3af;line-height:1.6;margin:0 0 20px 0;">Bonjour ${name},</p>
      <p style="color:#9ca3af;line-height:1.6;margin:0 0 32px 0;">
        Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte Sougra. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="${resetUrl}" 
           style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:700;font-size:16px;box-shadow:0 6px 20px rgba(16,185,129,0.3);">
          🔑 Choisir un nouveau mot de passe
        </a>
      </div>

      <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:32px 0 16px 0;border-top:1px solid #1e293b;padding-top:20px;">
        Ce lien expire dans <strong>1 heure</strong>. Si vous n'avez pas demandé ce changement, vous pouvez ignorer cet e-mail en toute sécurité.
      </p>

      <div style="background-color:#17222a;border:1px solid #23323e;border-radius:12px;padding:16px;margin-top:24px;">
        <p style="color:#4b5563;font-size:11px;margin:0;line-height:1.5;word-break:break-all;">
          Si le bouton ne fonctionne pas, copiez et collez l'URL suivante dans votre navigateur :<br>
          <a href="${resetUrl}" style="color:#10b981;text-decoration:none;">${resetUrl}</a>
        </p>
      </div>
    `
  );

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject: '🔑 Réinitialisation de votre mot de passe — Sougra',
      html,
    });
  } catch (err) {
    console.error('[EMAIL] Failed to send password reset email via SMTP:', err.message);
  }
}
