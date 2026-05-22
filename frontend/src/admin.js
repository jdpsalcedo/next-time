const ADMIN_EMAILS = new Set([
  'jdpsalcedo@gmail.com',
]);

export function isAdminUser(user) {
  if (!user?.email) return false;
  return ADMIN_EMAILS.has(user.email.toLowerCase());
}
