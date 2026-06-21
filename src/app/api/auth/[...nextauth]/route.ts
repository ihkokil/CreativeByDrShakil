import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/lib/auth-server";
import { cookies } from "next/headers";

const baseAdapter = PrismaAdapter(prisma);
const customAdapter = {
  ...baseAdapter,
  createUser: async (data: any) => {
    // NextAuth provides 'name', but your database requires 'fullName'
    return await prisma.user.create({
      data: {
        ...data,
        fullName: data.name || "Google User",
        emailVerified: true, // Google emails are already verified
      },
    });
  },
};

const handler = NextAuth({
  trustHost: true,
  adapter: customAdapter as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // `user` is only defined during the initial sign-in
      if (account && user) {
        // Find the user in the database to get their role
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email as string },
        });

        if (dbUser) {
          // Mint our custom JWT!
          const payload = {
            sub: dbUser.id,
            role: dbUser.role,
            email: dbUser.email,
          };
          const customToken = signAuthToken(payload);
          
          // Set the custom cookie so the rest of the application recognizes the session
          const cookieStore = await cookies();
          cookieStore.set(AUTH_COOKIE_NAME, customToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60, // 7 days
          });
        }
      }
      return token;
    },
  },
});

export { handler as GET, handler as POST };
