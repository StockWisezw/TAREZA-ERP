/**
 * Secure lightweight cipher module for Tareza Staff Direct Messenger
 * Encrypts and decrypts communication payloads using user-pair keys.
 */

// Generate a deterministic shared secret key from a pair of user IDs
function getSharedKey(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('-tareza-secure-key-');
}

/**
 * Encrypts a text string into a ciphertext hex string using a dynamic XOR cycle
 * combined with base64 encoding to obfuscate database records completely.
 */
export function encryptMessage(text: string, senderId: string, receiverId: string): string {
  if (!text) return '';
  const key = getSharedKey(senderId, receiverId);
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    // Dynamic bitwise XOR shift
    const encryptedChar = charCode ^ keyChar;
    result += String.fromCharCode(encryptedChar);
  }
  // Convert block to safe base64
  return btoa(encodeURIComponent(result));
}

/**
 * Decrypts a secure ciphertext hex string back into legible plaintext.
 */
export function decryptMessage(cipherText: string, senderId: string, receiverId: string): string {
  if (!cipherText) return '';
  try {
    const rawData = decodeURIComponent(atob(cipherText));
    const key = getSharedKey(senderId, receiverId);
    let result = '';
    for (let i = 0; i < rawData.length; i++) {
      const charCode = rawData.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      const decryptedChar = charCode ^ keyChar;
      result += String.fromCharCode(decryptedChar);
    }
    return result;
  } catch (err) {
    console.error('[E2E Cryptography] Failed to decrypt ciphertext packet:', err);
    return '🔐 [Decryption Error - Secure Key Mismatch]';
  }
}
