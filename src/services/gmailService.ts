import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { fireAuth } from '../lib/firebaseClient';

let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Clear token on sign-out
onAuthStateChanged(fireAuth, (user) => {
  if (!user) {
    cachedAccessToken = null;
  }
});

/**
 * Initiates the Google OAuth login flow with explicit Gmail scopes
 */
export async function googleSignInForGmail(): Promise<string> {
  if (isSigningIn) {
    throw new Error('Sign-in flow is already in progress');
  }

  try {
    isSigningIn = true;
    const provider = new GoogleAuthProvider();
    
    // Add required Gmail scopes
    provider.addScope('https://mail.google.com/');
    provider.addScope('https://www.googleapis.com/auth/gmail.compose');
    provider.addScope('https://www.googleapis.com/auth/gmail.modify');
    provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
    provider.addScope('https://www.googleapis.com/auth/gmail.send');

    const result = await signInWithPopup(fireAuth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google access token from sign-in.');
    }

    cachedAccessToken = credential.accessToken;
    return cachedAccessToken;
  } catch (error: any) {
    console.error('[GmailService] Auth failed:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Retrieves the cached access token or returns null if not authenticated
 */
export function getGmailAccessToken(): string | null {
  return cachedAccessToken;
}

/**
 * Helper to encode unicode string to base64url format
 */
function base64UrlEncode(str: string): string {
  const base64 = btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    })
  );
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Fetches a list of email messages
 */
export async function listGmailMessages(options: { query?: string; maxResults?: number } = {}) {
  const token = getGmailAccessToken();
  if (!token) throw new Error('Gmail authentication required');

  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  if (options.query) url.searchParams.append('q', options.query);
  if (options.maxResults) url.searchParams.append('maxResults', String(options.maxResults));

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to list messages: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetches detailed metadata and content of a single email
 */
export async function getGmailMessageDetails(messageId: string) {
  const token = getGmailAccessToken();
  if (!token) throw new Error('Gmail authentication required');

  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to load message details: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Sends a new email message
 */
export async function sendGmailEmail(options: { to: string; subject: string; body: string }) {
  const token = getGmailAccessToken();
  if (!token) throw new Error('Gmail authentication required');

  const emailLines = [
    `To: ${options.to}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${options.subject}`,
    '',
    options.body
  ];

  const rawMime = emailLines.join('\r\n');
  const base64Safe = base64UrlEncode(rawMime);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: base64Safe })
  });

  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Creates a new email draft
 */
export async function createGmailDraft(options: { to: string; subject: string; body: string }) {
  const token = getGmailAccessToken();
  if (!token) throw new Error('Gmail authentication required');

  const emailLines = [
    `To: ${options.to}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${options.subject}`,
    '',
    options.body
  ];

  const rawMime = emailLines.join('\r\n');
  const base64Safe = base64UrlEncode(rawMime);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: { raw: base64Safe }
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create draft: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Trashes/deletes an email message
 */
export async function trashGmailMessage(messageId: string) {
  const token = getGmailAccessToken();
  if (!token) throw new Error('Gmail authentication required');

  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to trash message: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Removes the INBOX label (archives the message)
 */
export async function archiveGmailMessage(messageId: string) {
  const token = getGmailAccessToken();
  if (!token) throw new Error('Gmail authentication required');

  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      removeLabelIds: ['INBOX']
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to archive message: ${response.statusText}`);
  }

  return response.json();
}
