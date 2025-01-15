import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { IAccountDoc } from "./database/account.model";
import { IUserDoc } from "./database/user.model";
import { api } from "./lib/api";
import { SignInSchema } from "./lib/validations";

// We'll check if the sign-in account type is credetntials; if yes, then we skip. We'll handle it the other way around when doing email password-based authentication.

// But if the account type is not credetials, we'll call this new `signin-with-oauth` app and create oAuth accounts.

// NextAuth: Biblioteka do zarządzania uwierzytelnianiem w aplikacjach Next.js.
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub,
    Google,
    Credentials({
      async authorize(credentials) {
        const validatedFields = SignInSchema.safeParse(credentials);

        if (validatedFields.success) {
          const { email, password } = validatedFields.data;

          const { data: existingAccount } = (await api.accounts.getByProvider(
            email
          )) as ActionResponse<IAccountDoc>;

          if (!existingAccount) return null;

          const { data: existingUser } = (await api.users.getById(
            existingAccount.userId.toString()
          )) as ActionResponse<IUserDoc>;

          if (!existingUser) return null;

          const isValidPassword = await bcrypt.compare(
            password,
            existingAccount.password!
          );

          if (isValidPassword) {
            return {
              id: existingUser.id,
              name: existingUser.name,
              email: existingUser.email,
              image: existingUser.image,
            };
          }
        }

        return null;
      },
    }),
  ],
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
      // success because whe know that every API call return the success ,which is either boolean true or false check type ActionResponse below
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

    // Wyjaśnienie:
    // Dane wejściowe:
    // session: Obiekt sesji, który NextAuth zamierza zwrócić do klienta.
    // token: Token JWT, który może zawierać dodatkowe dane, które mogą być użyte do wzbogacenia sesji.
    // Modyfikacja sesji:
    // session.user.id = token.sub as string; - Ta linia kodu przypisuje wartość sub z tokenu JWT do pola id w obiekcie user sesji. sub (subject) w JWT jest polem, które identyfikuje użytkownika, więc przypisujemy go do id, aby mieć bezpośredni dostęp do identyfikatora użytkownika w obiekcie sesji.
    // Zwrócenie zmodyfikowanej sesji:
    // Funkcja zwraca zmodyfikowany obiekt sesji, co oznacza, że wszystkie dalsze operacje, które korzystają z tego obiektu sesji (np. w middleware'ach, w komponentach React, itp.), będą miały dostęp do session.user.id.
    async session({ session, token }) {
      session.user.id = token.sub as string;
      return session;
    },

    // Ten fragment kodu definiuje callback jwt dla NextAuth.js, który jest używany do modyfikowania lub wzbogacania tokenu JWT (JSON Web Token) podczas procesu uwierzytelniania użytkownika. Oto szczegółowe wyjaśnienie:

    // JWT Callback: Wywoływany za każdym razem, gdy token JWT jest tworzony lub aktualizowany.
    async jwt({ token, account }) {
      // account jest dostępny tylko przy pierwszym logowaniu użytkownika lub gdy dane konta są aktualizowane. Sprawdzamy, czy account istnieje, aby zdecydować, czy należy zaktualizować token.
      if (account) {
        const { data: existingAccount, success } =
          (await api.accounts.getByProvider(
            account.type === "credentials"
              ? token.email!
              : account.providerAccountId
          )) as ActionResponse<IAccountDoc>;

        if (!success || !existingAccount) return token;

        const userId = existingAccount.userId;

        // Dlaczego to jest potrzebne?
        // Jednoznaczna identyfikacja użytkownika: W JWT, pole sub jest używane do jednoznacznej identyfikacji subiekta tokenu (w tym przypadku użytkownika). Tutaj, sub jest ustawiany na userId z bazy danych, co zapewnia, że każdy token JWT ma unikalny identyfikator użytkownika.
        // Integracja z systemem użytkowników: Jeśli twoja aplikacja ma zdefiniowane konta użytkowników w bazie danych, ten callback pozwala na połączenie informacji z logowania OAuth lub credentials z istniejącymi rekordami użytkownika, zapewniając spójność.
        // Bezpieczeństwo i spójność: Modyfikowanie tokenu w ten sposób pozwala na dodanie dodatkowych informacji bezpieczeństwa, jak unikalny identyfikator użytkownika, który może być używany podczas weryfikacji sesji.

        if (userId) token.sub = userId.toString();
      }
      return token;
    },
  },
});
