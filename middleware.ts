export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/income/:path*",
    "/expenses/:path*",
    "/tax/:path*",
    "/investments/:path*",
    "/insurance/:path*",
    "/loans/:path*",
    "/reminders/:path*",
    "/reports/:path*",
    "/settings/:path*",
  ],
};
