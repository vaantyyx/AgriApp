import nodemailer from 'nodemailer';
import fs from 'fs';

function getFromAddress() {
  const address = process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME || process.env.EMAIL_USER || 'support@sougra.com';
  const name = process.env.MAIL_FROM_NAME || 'Sougra';
  return `"${name}" <${address}>`;
}

function createTransporter() {
  // Support both EMAIL_* and MAIL_* naming conventions (MAIL_* takes precedence)
  const host = process.env.MAIL_HOST || process.env.EMAIL_HOST;
  const port = parseInt(process.env.MAIL_PORT || process.env.EMAIL_PORT || '587');
  const user = process.env.MAIL_USERNAME || process.env.EMAIL_USER;
  const pass = process.env.MAIL_PASSWORD || process.env.EMAIL_PASS;
  const encryption = (process.env.MAIL_ENCRYPTION || '').toLowerCase();

  if (!host || !user || !pass) {
    console.warn('[EMAIL] SMTP credentials not configured. Emails will not be sent.');
    return null;
  }

  const isSecure = port === 465 || encryption === 'ssl';

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

export async function sendVerificationEmail(to, name, token) {
  const transporter = createTransporter();
  const APP_URL = process.env.APP_URL || 'http://localhost:5173';
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

  // Always log the link to the console for easy developer/local verification
  console.log(`\n==================================================`);
  console.log(`[EMAIL DEV] Verification link for ${to}:`);
  console.log(`👉 ${verifyUrl}`);
  console.log(`==================================================\n`);

  try {
    fs.appendFileSync('email_dev.log', `[${new Date().toISOString()}] VERIFY for ${to}: ${verifyUrl}\n`);
  } catch (err) {
    console.error('Failed to write dev email log:', err.message);
  }

  if (!transporter) {
    return; // Silently skip in dev when not configured
  }

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirmez votre email — Sougra</title>
    </head>
    <body style="margin:0;padding:0;background:#0b0f12;font-family:'Segoe UI',Arial,sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:rgba(18,26,32,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
        
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#10b981,#059669);padding:32px;text-align:center;">
          <div style="font-size:32px;margin-bottom:8px;">🌿</div>
          <h1 style="color:#fff;margin:0;font-size:1.6rem;font-weight:800;letter-spacing:-0.02em;">Sougra</h1>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:0.9rem;">Plateforme d'Enchères Agricoles</p>
        </div>

        <!-- Content -->
        <div style="padding:40px 32px;">
          <h2 style="color:#f3f4f6;font-size:1.4rem;margin:0 0 12px;font-weight:700;">Bonjour, ${name} 👋</h2>
          <p style="color:#9ca3af;line-height:1.7;margin:0 0 28px;font-size:0.95rem;">
            Merci de vous être inscrit sur <strong style="color:#f3f4f6;">Sougra</strong>. 
            Confirmez votre adresse email pour activer votre compte et accéder à la plateforme.
          </p>

          <div style="text-align:center;margin:32px 0;">
            <a href="${verifyUrl}" 
               style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:700;font-size:1rem;letter-spacing:0.01em;box-shadow:0 4px 14px rgba(16,185,129,0.4);">
              ✅ Confirmer mon email
            </a>
          </div>

          <p style="color:#6b7280;font-size:0.8rem;line-height:1.6;margin:0 0 16px;">
            Ce lien expire dans <strong>24 heures</strong>. Si vous n'avez pas créé de compte, ignorez cet email.
          </p>

          <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;margin-top:20px;">
            <p style="color:#4b5563;font-size:0.75rem;margin:0;">
              Lien ne fonctionne pas ? Copiez et collez l'URL ci-dessous :<br>
              <span style="color:#10b981;word-break:break-all;">${verifyUrl}</span>
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background:rgba(0,0,0,0.2);padding:20px 32px;text-align:center;">
          <p style="color:#4b5563;font-size:0.75rem;margin:0;">
            © ${new Date().getFullYear()} Sougra — Plateforme d'Enchères Inversées Agricoles en Algérie
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject: '✅ Confirmez votre adresse email — Sougra',
      html,
    });
  } catch (err) {
    console.error('[EMAIL] Failed to send verification email via SMTP:', err.message);
  }
}


export async function sendWelcomeEmail(to, name, role) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[EMAIL DEV] Welcome email would be sent to ${to}`);
    return;
  }

  const roleLabel = role === 'buyer' ? 'Acheteur' : 'Producteur';

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject: '🌿 Bienvenue sur Sougra !',
      html: `
        <div style="max-width:560px;margin:40px auto;background:#121a20;border-radius:16px;padding:40px;font-family:Arial,sans-serif;color:#f3f4f6;">
          <h1 style="color:#10b981;">🎉 Bienvenue, ${name} !</h1>
          <p style="color:#9ca3af;">Votre compte <strong>${roleLabel}</strong> est maintenant actif.</p>
          <p style="color:#9ca3af;">Connectez-vous pour commencer à utiliser Sougra.</p>
          <a href="${process.env.APP_URL || 'http://localhost:5173'}" 
             style="display:inline-block;background:#10b981;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:20px;">
            Accéder à la plateforme
          </a>
        </div>
      `,
    });
  } catch (err) {
    console.error('[EMAIL] Failed to send welcome email via SMTP:', err.message);
  }
}

export async function sendOtpEmail(to, name, otp, minutes, title, subject, desc) {
  const transporter = createTransporter();
  console.log(`\n==================================================`);
  console.log(`[EMAIL DEV] OTP Code for ${to} (${name}):`);
  console.log(`👉 ${otp} (Expires in ${minutes} minutes)`);
  console.log(`==================================================\n`);

  try {
    fs.appendFileSync('email_dev.log', `[${new Date().toISOString()}] OTP for ${to}: ${otp}\n`);
  } catch (err) {
    console.error('Failed to write dev OTP log:', err.message);
  }

  if (!transporter) {
    return; // Silently skip in dev when not configured
  }

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>${subject}</title>
    </head>
    <body style="margin:0;padding:0;background:#0b0f12;font-family:Arial,sans-serif;color:#f3f4f6;">
      <div style="max-width:560px;margin:40px auto;background:#121a20;border-radius:16px;padding:40px;border:1px solid rgba(255,255,255,0.08);">
        <h1 style="color:#10b981;font-size:1.6rem;margin-top:0;">${title}</h1>
        <p style="color:#9ca3af;font-size:0.95rem;line-height:1.6;">Bonjour ${name},</p>
        <p style="color:#9ca3af;font-size:0.95rem;line-height:1.6;">${desc}</p>
        <div style="text-align:center;margin:32px 0;">
          <span style="display:inline-block;background:#1b252c;color:#10b981;padding:14px 28px;font-size:24px;font-weight:bold;letter-spacing:6px;border-radius:10px;border:1px solid rgba(16,185,129,0.3);">
            ${otp}
          </span>
        </div>
        <p style="color:#6b7280;font-size:0.8rem;">Ce code est valide pendant ${minutes} minutes. S'il ne provient pas de vous, ignorez ce message.</p>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('[EMAIL] Failed to send OTP email via SMTP:', err.message);
  }
}

export async function sendAccountDeactivationEmail(to, name) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[EMAIL DEV] Deactivation confirmation email would be sent to ${to}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject: 'ℹ️ Confirmation de désactivation de votre compte — Sougra',
      html: `
        <div style="max-width:560px;margin:40px auto;background:#121a20;border-radius:16px;padding:40px;font-family:Arial,sans-serif;color:#f3f4f6;">
          <h1 style="color:#f59e0b;">👋 Compte désactivé</h1>
          <p style="color:#9ca3af;">Bonjour ${name},</p>
          <p style="color:#9ca3af;">Votre compte Sougra a bien été désactivé.</p>
          <p style="color:#9ca3af;">Si vous souhaitez réactiver votre compte, veuillez contacter notre support à <a href="mailto:support@sougra.com" style="color:#10b981;">support@sougra.com</a>.</p>
          <p style="color:#6b7280;font-size:0.8rem;margin-top:30px;">Si vous n'êtes pas à l'origine de cette action, contactez-nous immédiatement.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[EMAIL] Failed to send deactivation email via SMTP:', err.message);
  }
}

