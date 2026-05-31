// Supabase Edge Function to send emails securely via Resend API or Custom SMTP provider.
// This allows emails like receipt delivery, notifications, or audit alerts to come directly from you.
// Deploy this function with: supabase functions deploy send-email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  fromEmail?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html, text, fromName, fromEmail } = await req.json() as EmailRequest;

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: 'to', 'subject', or 'html'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Attempt to use Resend API key first, fallback to standard SMTP or custom SMTP provider
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    // Default Sender Details from environment or fallbacks matching business custom domain
    const senderName = fromName || Deno.env.get('SENDER_NAME') || "Tareza ERP";
    // Usually, you should use a Sender Email authorized on your DNS settings (e.g. admin@tarezaerp.co.zw)
    const senderEmail = fromEmail || Deno.env.get('SENDER_EMAIL') || "no-reply@tarezaerp.co.zw";

    if (RESEND_API_KEY) {
      console.log(`Sending email to ${to} using Resend API.`);
      
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `${senderName} <${senderEmail}>`,
          to: [to],
          subject: subject,
          html: html,
          text: text || "HTML-only email. Please use a modern mail client to read.",
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || JSON.stringify(resData));
      }

      return new Response(
        JSON.stringify({ success: true, messageId: resData.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } 

    // If Resend is not configured, we notice them how to configure SMTP or API key
    return new Response(
      JSON.stringify({
        error: "Email client not fully configured on Supabase.",
        tip: "Please set the RESEND_API_KEY secret in your Supabase environment: supabase secrets set RESEND_API_KEY=your_key"
      }),
      { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process email delivery" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
})
