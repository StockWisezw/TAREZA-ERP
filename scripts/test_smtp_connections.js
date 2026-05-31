/**
 * TAREZA ERP - SMTP CONNECTION TESTER SCRIPT
 * 
 * Run this diagnostic script locally to verify your custom SMTP servers (e.g. Gmail or Zoho SMTP)
 * are working correctly before configuring your Supabase project settings.
 * 
 * Usage:
 * 1. Set credentials in terminal environment or edit the config object below.
 * 2. Execute: node scripts/test_smtp_connections.js
 */

import nodemailer from 'nodemailer';

// Configuration presets - Edit this or set environment variables
const SMTP_CONFIG = {
  // e.g. 'smtp.gmail.com' for Google or 'smtp.zoho.com' for Zoho Mail
  host: process.env.SMTP_HOST || 'smtp.gmail.com', 
  port: parseInt(process.env.SMTP_PORT || '587', 10), // SSL: 465, TLS: 587
  secure: process.env.SMTP_SECURE === 'true' || false, // true for 465, false for 587
  auth: {
    // e.g. 'tapsforex@gmail.com' or 'admin@tarezaerp.co.zw'
    user: process.env.SMTP_USER || 'tapsforex@gmail.com', 
    // For Gmail, use an App Password (16 characters), NOT your main Google Password!
    pass: process.env.SMTP_PASS || 'your_app_password_here', 
  },
  senderEmail: process.env.SMTP_SENDER || 'tapsforex@gmail.com',
  senderName: process.env.SMTP_SENDER_NAME || 'Tareza ERP Dispatcher',
  testRecipient: process.env.SMTP_TEST_RECIPIENT || 'tapsforex@gmail.com'
};

async function runSmtpDiagnostics() {
  console.log('====================================================');
  console.log('       TAREZA ERP - SMTP CONFIG DIALECT CHECKER      ');
  console.log('====================================================');
  console.log(`Targeting Domain Host:  ${SMTP_CONFIG.host}`);
  console.log(`Port Mapping Priority:  ${SMTP_CONFIG.port} (Secure: ${SMTP_CONFIG.secure})`);
  console.log(`Authenticated Sender:   ${SMTP_CONFIG.auth.user}`);
  console.log(`Testing Destination:   ${SMTP_CONFIG.testRecipient}`);
  console.log('----------------------------------------------------');

  if (SMTP_CONFIG.auth.pass === 'your_app_password_here' || !SMTP_CONFIG.auth.pass) {
    console.error('ERROR: Please specify a valid SMTP password or App Password in the SMTP_CONFIG object.');
    process.exit(1);
  }

  // Define transport settings
  const transporter = nodemailer.createTransport({
    host: SMTP_CONFIG.host,
    port: SMTP_CONFIG.port,
    secure: SMTP_CONFIG.secure,
    auth: {
      user: SMTP_CONFIG.auth.user,
      pass: SMTP_CONFIG.auth.pass,
    },
    tls: {
      rejectUnauthorized: true
    }
  });

  try {
    console.log('⏳ 1. Verifying SMTP server connectivity and handshake...');
    await transporter.verify();
    console.log('✅ Handshake succeeded! Connection settings are 100% correct.');

    console.log('\n⏳ 2. Executing transactional test email dispatch...');
    const info = await transporter.sendMail({
      from: `"${SMTP_CONFIG.senderName}" <${SMTP_CONFIG.senderEmail}>`,
      to: SMTP_CONFIG.testRecipient,
      subject: `Tareza ERP - SMTP Validation Transaction`,
      text: `Hello,\n\nThis is an automated test email confirming that your custom SMTP settings are fully functional.\n\nSettings Tested:\nHost: ${SMTP_CONFIG.host}\nPort: ${SMTP_CONFIG.port}\nSender: ${SMTP_CONFIG.auth.user}\n\nTimestamp: ${new Date().toLocaleString()}`,
      html: `
        <div style="font-family: sans-serif; padding: 24px; max-width: 600px; margin: auto; border: 1px solid #e4e4e7; border-radius: 8px;">
          <h2 style="color: #18181b; margin-top: 0;">Tareza ERP Custom SMTP Verified</h2>
          <p style="color: #52525b; line-height: 1.5;">This email confirms that your SMTP server configuration parameters are correct and ready to be loaded into your Supabase Dashboard.</p>
          <div style="background-color: #f4f4f5; padding: 16px; border-radius: 6px; margin: 20px 0; font-family: monospace; font-size: 13px;">
            <strong>SMTP Host:</strong> ${SMTP_CONFIG.host}<br/>
            <strong>Port:</strong> ${SMTP_CONFIG.port}<br/>
            <strong>Sender:</strong> ${SMTP_CONFIG.auth.user}<br/>
            <strong>Encryption:</strong> ${SMTP_CONFIG.secure ? 'SSL/TLS' : 'STARTTLS'}
          </div>
          <p style="color: #71717a; font-size: 12px; margin-bottom: 0;">Triggered by developer command line testing script at ${new Date().toLocaleString()}.</p>
        </div>
      `,
    });

    console.log(`✅ Mail successfully dispatched! Message ID: ${info.messageId}`);
    console.log('\n🌟 YOUR SETTINGS ARE CONFIRMED. YOU CAN SAFELY PASTE THEM INTO THE SUPABASE DASHBOARD.');
  } catch (err) {
    console.error('\n❌ SMTP DIAGNOSTICS FAILURE:');
    console.error(err);
    console.log('\n💡 HELPFUL HINTS:');
    if (SMTP_CONFIG.host.includes('gmail')) {
      console.log('- For Gmail: Ensure you are using an "App Password" generated in your Google Account settings, NOT your main login password.');
      console.log('- For Gmail: Ensure your security port is 587 with "secure: false" (STARTTLS) or 465 with "secure: true" (SSL/TLS).');
    } else if (SMTP_CONFIG.host.includes('zoho')) {
      console.log('- For Zoho: Ensure you have enabled SMTP access inside your Zoho Mail settings -> Mail Accounts -> IMAP/POP/SMTP options.');
    }
  }
}

runSmtpDiagnostics();
