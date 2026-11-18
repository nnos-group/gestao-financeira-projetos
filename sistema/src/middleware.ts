import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_SESSION_NAME,
  obterRotaPadraoPerfil,
  verificarTokenSessao,
} from "@/lib/session-token";

const EXTENSOES_ESTATICAS_REGEX =
  /\.(png|jpg|jpeg|svg|ico|pdf|css|js|woff2|woff|ttf|webp|gif|map)$/i;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/politicas") ||
    pathname === "/favicon.ico" ||
    EXTENSOES_ESTATICAS_REGEX.test(pathname)
  ) {
    return NextResponse.next();
  }

  const tokenBruto = req.cookies.get(COOKIE_SESSION_NAME)?.value;
  const sessao = await verificarTokenSessao(tokenBruto);

  if (!sessao) {
    if (pathname === "/login" || pathname.startsWith("/login/")) {
      const res = NextResponse.next();
      if (tokenBruto) {
        res.cookies.set(COOKIE_SESSION_NAME, "", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 0,
        });
      }
      return res;
    }

    const res = NextResponse.redirect(new URL("/login", req.url));
    if (tokenBruto) {
      res.cookies.set(COOKIE_SESSION_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }
    return res;
  }

  const rotaPadrao = obterRotaPadraoPerfil(sessao.perfilId);

  if (pathname === "/" || pathname === "/login" || pathname.startsWith("/login/")) {
    return NextResponse.redirect(new URL(rotaPadrao, req.url));
  }

  if (pathname.startsWith("/admin") && sessao.perfilId !== "ADMIN") {
    return NextResponse.redirect(new URL(rotaPadrao, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
