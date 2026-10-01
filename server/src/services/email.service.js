import nodemailer from 'nodemailer';

let transporter;

const getTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  const missingSettings = [
    ['SMTP_HOST', SMTP_HOST],
    ['SMTP_USER', SMTP_USER],
    ['SMTP_PASS', SMTP_PASS],
  ].filter(([, value]) => !value).map(([key]) => key);
  if (missingSettings.length) {
    console.warn(`[email] Offline notification skipped; configure ${missingSettings.join(', ')} in server/.env.`);
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: SMTP_SECURE === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
};

export const sendOfflineMessageEmail = async ({ recipient, senderName, message }) => {
  const mailTransporter = getTransporter();
  if (!mailTransporter) return false;

  await mailTransporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: recipient.email,
    subject: `New PulseChat message from ${senderName}`,
    text: `${senderName} sent you a message on PulseChat:\n\n${message}\n\nSign in to PulseChat to reply.`,
  });
  return true;
};