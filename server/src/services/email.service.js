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
      port: Number(SMTP_PORT || 465),
      secure: SMTP_SECURE === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
};

export const sendOfflineMessageEmail = async ({ recipient, senderName, message }) => {
  if (!recipient?.email) {
    console.warn('[email] Recipient has no email address. Skipping email notification.');
    return false;
  }

  const mailTransporter = getTransporter();
  if (!mailTransporter) return false;

  try {
    await mailTransporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: recipient.email,
      subject: `New Conversa message from ${senderName}`,
      text: `${senderName} sent you a message on Conversa:\n\n${message}\n\nSign in to Conversa to reply.`,
    });
    console.log(`[email] Offline message email successfully sent to ${recipient.email}`);
    return true;
  } catch (error) {
    console.error(`[email] Error sending offline message email to ${recipient.email}:`, error.message);
    throw error;
  }
};