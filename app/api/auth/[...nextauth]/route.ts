import { handlers } from "@/auth"; // Referring to the auth.ts we just created
export const { GET, POST } = handlers;

// handlers zawiera funkcje do obsługi żądań dla różnych metod HTTP (jak GET, POST), które są automatycznie generowane przez NextAuth.js dla procesów uwierzytelniania.

// Ścieżka URL: /api/auth/[...nextauth]

// Gdzie:

// /api jest prefiksem dla endpointów API w konwencji Next.js.
// auth jest częścią ścieżki określającą, że chodzi o uwierzytelnianie.
// [...nextauth] jest dynamiczną ścieżką, która pozwala na obsługę różnych subpathów przez NextAuth.js. To specjalna składnia Next.js, która oznacza, że wszystko po /auth/ zostanie przekazane jako parametr do handlerów NextAuth.js, pozwalając na obsługę różnych akcji, takich jak logowanie, wylogowanie, callbacki itp.

// Przykłady konkretnych URL:
// Logowanie przez GitHub: /api/auth/signin/github
// Callback po uwierzytelnieniu przez Google: /api/auth/callback/google
// Wylogowanie: /api/auth/signout

// Każda z tych ścieżek będzie kierowana do odpowiedniego handlera w handlers z NextAuth.js, który obsługuje konkretne żądania i procesy uwierzytelniania.

// Podsumowanie:
// Ten kod w route.ts jest kluczowy dla integracji NextAuth.js z nowym systemem routingu w Next.js, umożliwiając obsługę żądań uwierzytelniania przez API, co jest zarówno bezpieczne, jak i efektywne z punktu widzenia architektury aplikacji.
