export const ROUTES = {
  home: "/",
  login: "/login",
  otp: "/otp",
  twoFactor: "/2fa",
  forgotPassword: "/forgot-password",
  admin: "/admin",
  adminDashboard: "/admin/dashboard",
} as const;

/** Build an admin micro-screen path: /admin/<module>/<screen>. */
export function adminPath(module: string, screen: string): string {
  return `/admin/${module}/${screen}`;
}
