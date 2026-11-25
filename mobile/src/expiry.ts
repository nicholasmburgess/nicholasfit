import Constants from "expo-constants";

/** A free Apple account signs an install for 7 days. */
const INSTALL_DAYS = 7;

/**
 * When this install stops opening: 7 days after it was built. If Xcode reused a signing profile from an
 * earlier install that week, the real expiry can be sooner, so reminders lean early (a day and 2 hours before).
 */
export function expiresAt(): string | null {
  const built = (Constants.expoConfig?.extra as { builtAt?: string } | undefined)?.builtAt;
  if (!built || Number.isNaN(Date.parse(built))) return null;
  return new Date(Date.parse(built) + INSTALL_DAYS * 86400e3).toISOString();
}
