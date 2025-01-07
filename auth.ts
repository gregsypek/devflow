import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { IAccountDoc } from "./database/account.model";
import { api } from "./lib/api";

// We'll check if the sign-in account type is credetntials; if yes, then we skip. We'll handle it the other way around when doing email password-based authentication.

// But if the account type is not credetials, we'll call this new `signin-with-oauth` app and create oAuth accounts.

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub, Google],
  callbacks: {
    async signIn({ user, profile, account }) {
      if (account?.type === "credentials") return true;
      if (!account || !user) return false;

      const userInfo = {
        name: user.name!, // user.name! oznacza, że programista jest pewien, że user.name ma wartość w tym miejscu, mimo że typ User mógłby sugerować, że name może być null lub undefined.
        email: user.email!,
        image: user.image!,
        username:
          account.provider === "github"
            ? (profile?.login as string)
            : (user.name?.toLowerCase() as string),
      };

      const { success } = (await api.auth.oAuthSignIn({
        user: userInfo,
        provider: account.provider as "github" | "google",
        providerAccountId: account.providerAccountId,
      })) as ActionResponse;

      // type ActionResponse<T = null> = {
      //   success: boolean;
      //   data?: T;
      //   error?: {
      //     message: string;
      //     details?: Record<string, string[]>;
      //   };
      //   status?: number;
      // };

      if (!success) return false;

      return true;
    },
    async session({ session, token }) {
      session.user.id = token.sub as string;
      return session;
    },
    async jwt({ token, account }) {
      if (account) {
        const { data: existingAccount, success } =
          (await api.accounts.getByProvider(
            account.type === "credentials"
              ? token.email!
              : account.providerAccountId
          )) as ActionResponse<IAccountDoc>;

        if (!success || !existingAccount) return token;

        const userId = existingAccount.userId;

        if (userId) token.sub = userId.toString();
      }
      return token;
    },
  },
});
