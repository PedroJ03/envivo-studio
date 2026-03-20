import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { AuthOptions, Session } from "next-auth";

type OperatorUser = {
  id: string;
  email: string;
  tenantId: string;
  role: string;
};

type AuthCallbackConfig = {
  auth: () => Promise<(Session & { user?: { tenantId?: string } }) | null>;
  handlers?: {
    GET: () => unknown;
    POST: () => unknown;
  };
  signIn?: (...args: unknown[]) => unknown;
  signOut?: (...args: unknown[]) => unknown;
};

type RouteHandler = (request?: unknown, context?: unknown) => Promise<unknown>;

export const authConfig: AuthOptions = {
  providers: [
    Credentials({
      name: "Internal",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "operator@envivo-studio.com" },
        password: { label: "Password", type: "password" },
        tenantId: { label: "Tenant", type: "text", placeholder: "envivo-tandil" },
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
      const nextSession = params.session as Session & { user?: { tenantId?: string } };

      if (nextSession.user && params.token.tenantId) {
        nextSession.user.tenantId = params.token.tenantId as string;
      }
      return nextSession;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const authResult = NextAuth(authConfig) as AuthCallbackConfig;

export const auth = authResult.auth ?? authResult;
export const handlers = authResult.handlers;
export const signIn = authResult.signIn;
export const signOut = authResult.signOut;

const fallbackAuthHandler: RouteHandler = async () => {
  return new Response(null, { status: 501 });
};

export const GET = handlers?.GET ?? fallbackAuthHandler;
export const POST = handlers?.POST ?? fallbackAuthHandler;
