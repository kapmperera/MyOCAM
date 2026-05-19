import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "admin" },
        password: { label: "Password", type: "password", placeholder: "admin123" }
      },
      async authorize(credentials, req) {
        // Hardcoded admin for prototyping MVP
        if (credentials.username === "admin" && credentials.password === "admin123") {
          return { id: "1", name: "Admin User", email: "admin@myocam.edu" };
        }
        return null;
      }
    })
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback_secret_for_local_dev_only_myocam"
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
