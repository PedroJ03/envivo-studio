import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { AuthOptions, Session } from "next-auth";
import type { NextRequest } from "next/server";

type OperatorUser = {
  id: string;
  email: string;
  tenantId: string;
  role: string;
};

export const authConfig: AuthOptions = {
  providers: [
    Credentials({
      name: "Internal",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "operator@envivo-studio.com",
        },
        password: { label: "Password", type: "password" },
        tenantId: {
          label: "Tenant",
          type: "text",
          placeholder: "envivo-tandil",
        },
      },
      async authorize(credentials) {
        // TODO: Replace this with your own user lookup + password verification.
        if (!credentials?.email || !credentials?.tenantId) {
          return null;
        }

        return {
          id: `local-${credentials.email}`,
          email: credentials.email,
          tenantId: credentials.tenantId,
          role: "operator",
        } satisfies OperatorUser;
      },
    }),
  ],
  callbacks: {
    jwt(params) {
      const operatorUser = params.user as { tenantId?: string } | undefined;

      if (operatorUser?.tenantId) {
        params.token.tenantId = operatorUser.tenantId;
      }

      return params.token;
    },
    session(params) {
      const nextSession = params.session as Session & {
        user?: { tenantId?: string };
      };

      if (nextSession.user && params.token.tenantId) {
        nextSession.user.tenantId = params.token.tenantId as string;
      }
      return nextSession;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Create NextAuth handler
const handler = NextAuth(authConfig);

// Export auth helpers
export const auth = handler.auth;
export const signIn = handler.signIn;
export const signOut = handler.signOut;

// Export GET and POST handlers for App Router
export const GET = (request: NextRequest) => handler.GET(request);
export const POST = (request: NextRequest) => handler.POST(request);
