import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/auth",
  },
  callbacks: {
    async signIn({ user }) {
      // Only allow your specific email(s)
      const allowedEmails = (process.env.ALLOWED_EMAILS || "").split(",").map((e) => e.trim().toLowerCase());
      if (allowedEmails.length > 0 && allowedEmails[0] !== "") {
        return allowedEmails.includes(user.email?.toLowerCase() || "");
      }
      return true; // If no allowed emails configured, allow all
    },
    async session({ session }) {
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
