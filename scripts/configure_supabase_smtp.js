/**
 * Programmatic configuration tool to update Supabase remote SMTP Auth configurations.
 * 
 * Uses the official Supabase Management API to let you patch your authentication SMTP
 * server settings in one click from the CLI instead of navigating the web UI.
 * 
 * Usage:
 *   1. Retrieve your Supabase Personal Access Token (from Dashboard -> Account -> Access Tokens)
 *   2. Retrieve your Supabase Project Reference (from Dashboard -> Settings -> General)
 *   3. Run: SUPABASE_TOKEN="your-token" PROJECT_REF="your-project-ref" node scripts/configure_supabase_smtp.js
 */

import fetch from 'node-fetch';

const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || '';
const PROJECT_REF = process.env.PROJECT_REF || '';

const SMTP_CONFIGURATION = {
  smtp_admin_user: process.env.SMTP_SENDER_EMAIL || 'tapsforex@gmail.com', // Sender Address
  smtp_sender_name: process.env.SMTP_SENDER_NAME || 'Tareza ERP',        // Sender Display Name
  smtp_host: process.env.SMTP_HOST || 'smtp.gmail.com',                 // Host Address
  smtp_port: parseInt(process.env.SMTP_PORT || '587', 10),              // Smtp Port
  smtp_user: process.env.SMTP_USER || 'tapsforex@gmail.com',            // Auth SMTP Username
  smtp_pass: process.env.SMTP_PASS || 'your_app_password',              // SMTP Password
};

async function updateSupabaseSmtp() {
  console.log('==================================================');
  console.log('    SUPABASE SMTP PROGRAMMATIC SETTINGS PATCHER   ');
  console.log('==================================================');

  if (!SUPABASE_TOKEN || !PROJECT_REF) {
    console.error('❌ ERROR: Missing credentials. Please execute using:');
    console.error('  SUPABASE_TOKEN="sbp_xxxx" PROJECT_REF="abcdefg" node scripts/configure_supabase_smtp.js\n');
    process.exit(1);
  }

  if (SMTP_CONFIGURATION.smtp_pass === 'your_app_password') {
    console.error('❌ ERROR: Please supply a real SMTP password.');
    process.exit(1);
  }

  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/auth/config`;

  console.log(`📡 Connecting to Supabase Project API: ${PROJECT_REF}...`);
  console.log(`📤 Sending payload configs for sender: ${SMTP_CONFIGURATION.smtp_admin_user}`);

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SUPABASE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(SMTP_CONFIGURATION)
    });

    const parsed = await response.json();

    if (!response.ok) {
      throw new Error(`Supabase API server responded with status [${response.status}]: ${JSON.stringify(parsed)}`);
    }

    console.log('✅ SUCCESS! Your SMTP Settings have been successfully patched on your remote Supabase Project.');
    console.log('🎉 All future verification, password reset, and registration emails will come from your custom SMTP!');
  } catch (error) {
    console.error('❌ API FAILURE:');
    console.error(error.message);
  }
}

updateSupabaseSmtp();
