import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.emailSecure,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
});

function buildEmail(bodyHtml: string, footerText: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 16px;">
        <tr>
          <td align="center">
            <table width="100%" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              <tr>
                <td style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:32px 40px;text-align:center;">
                  <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:14px;margin:0 auto 16px;line-height:56px;font-size:30px;">🐝</div>
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">BusyBee</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:36px 40px;">
                  ${bodyHtml}
                </td>
              </tr>
              <tr>
                <td style="background-color:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #f1f5f9;">
                  <p style="margin:0;color:#cbd5e1;font-size:12px;">${footerText}</p>
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

export async function sendRegistrationEmail(to: string, token: string, displayName: string): Promise<void> {
  const link = `${env.FRONTEND_URL}/auth/verify?token=${token}`;

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject: '欢迎加入 BusyBee',
    html: buildEmail(
      `<h2 style="margin:0 0 12px;color:#1e293b;font-size:18px;font-weight:600;">欢迎加入，${displayName}！🎉</h2>
       <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
         您的账号已创建成功。点击下方按钮完成验证并登录。此链接 <strong>15 分钟内有效</strong>，且只能使用一次。
       </p>
       <div style="text-align:center;margin:32px 0;">
         <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:600;box-shadow:0 4px 12px rgba(79,70,229,0.35);">
           完成注册并登录 →
         </a>
       </div>
       <hr style="border:none;border-top:1px solid #f1f5f9;margin:28px 0;">
       <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">如果按钮无法点击，请复制以下链接到浏览器：</p>
       <p style="margin:0;word-break:break-all;color:#6366f1;font-size:12px;">${link}</p>`,
      '如果您未进行注册操作，请忽略此邮件。',
    ),
    text: `欢迎加入 BusyBee，${displayName}！\n\n点击以下链接完成验证并登录（15分钟内有效）：\n\n${link}\n\n如果您未进行注册操作，请忽略此邮件。`,
  });
}

export async function sendAdminCreatedUserEmail(
  to: string,
  token: string,
  displayName: string,
  username: string,
): Promise<void> {
  const link = `${env.FRONTEND_URL}/auth/verify?token=${token}`;

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject: '您已被邀请加入 BusyBee / You have been invited to BusyBee',
    html: buildEmail(
      `<h2 style="margin:0 0 12px;color:#1e293b;font-size:18px;font-weight:600;">
         您好，${displayName}！🎉<br>
         <span style="font-size:14px;color:#64748b;font-weight:400;">Hello, ${displayName}!</span>
       </h2>
       <p style="margin:0 0 8px;color:#475569;font-size:15px;line-height:1.6;">
         管理员已为您创建了 BusyBee 账号。<br>
         <span style="font-size:13px;color:#94a3b8;">An admin has created a BusyBee account for you.</span>
       </p>
       <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin:20px 0;border:1px solid #e2e8f0;">
         <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;">用户名 / Username</p>
         <p style="margin:0;color:#1e293b;font-size:17px;font-weight:700;letter-spacing:0.2px;">${username}</p>
       </div>
       <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">
         点击下方按钮即可登录，链接 <strong>24 小时内有效</strong>，且只能使用一次。<br>
         <span style="font-size:13px;color:#94a3b8;">Click the button below to sign in. The link is valid for <strong>24 hours</strong> and can only be used once.</span>
       </p>
       <div style="text-align:center;margin:32px 0;">
         <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:600;box-shadow:0 4px 12px rgba(79,70,229,0.35);">
           登录 BusyBee / Sign In →
         </a>
       </div>
       <hr style="border:none;border-top:1px solid #f1f5f9;margin:28px 0;">
       <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">如果按钮无法点击，请复制以下链接到浏览器 / If the button doesn't work, copy this link:</p>
       <p style="margin:0;word-break:break-all;color:#6366f1;font-size:12px;">${link}</p>`,
      '如果您未预期收到此邮件，请忽略。 / If you were not expecting this email, please ignore it.',
    ),
    text: `您好 ${displayName}！\n\n管理员已为您创建了 BusyBee 账号。\n用户名 / Username: ${username}\n\n点击以下链接登录（24小时内有效，仅限一次）：\n${link}\n\n如果您未预期收到此邮件，请忽略。`,
  });
}

export async function sendMagicLinkEmail(to: string, token: string, displayName?: string): Promise<void> {
  const link = `${env.FRONTEND_URL}/auth/verify?token=${token}`;
  const greeting = displayName ? `，${displayName}` : '';

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject: '登录 BusyBee',
    html: buildEmail(
      `<h2 style="margin:0 0 12px;color:#1e293b;font-size:18px;font-weight:600;">欢迎回来${greeting}！</h2>
       <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
         点击下方按钮即可安全登录。此链接 <strong>15 分钟内有效</strong>，且只能使用一次。
       </p>
       <div style="text-align:center;margin:32px 0;">
         <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:600;box-shadow:0 4px 12px rgba(79,70,229,0.35);">
           登录 BusyBee →
         </a>
       </div>
       <hr style="border:none;border-top:1px solid #f1f5f9;margin:28px 0;">
       <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">如果按钮无法点击，请复制以下链接到浏览器：</p>
       <p style="margin:0;word-break:break-all;color:#6366f1;font-size:12px;">${link}</p>`,
      '如果您未请求此邮件，请忽略它。您的账户是安全的。',
    ),
    text: `欢迎回来${greeting}！\n\n点击以下链接登录 BusyBee（15分钟内有效）：\n\n${link}\n\n如果您未请求此邮件，请忽略它。`,
  });
}
