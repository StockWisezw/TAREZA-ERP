// System Administrator Whitelist Configuration
export const AUTHORIZED_ADMIN_EMAILS: readonly string[] = Object.freeze([
  'tapiwagahadza54@gmail.com',
  'tapsforex@gmail.com',
  'tapsforex@gamil.com',
  'admin@tarezaerp.co.zw',
  'sales@tarezaerp.co.zw',
  'petronellamutero@gmail.com'
]);

/**
 * Validates whether the given email has System Administrator / Firebase Admin SDK dashboard access.
 */
export function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();
  return AUTHORIZED_ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase().trim() === cleanEmail);
}
