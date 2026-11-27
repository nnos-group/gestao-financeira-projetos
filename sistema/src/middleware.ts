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
    pathname.startsWith("/politicas") ||
    pathname === "/favicon.ico" ||
    EXTENSOES_ESTATICAS_REGEX.test(pathname)
  ) {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith("/api");
  const isApiPublica =
    pathname === "/api/auth/login" ||
    pathname.startsWith("/api/webhooks/zoho-sign") ||
    (pathname === "/api/viagens/anexo" && req.method === "GET");

  if (isApiPublica) {
    return NextResponse.next();
  }

  const tokenBruto = req.cookies.get(COOKIE_SESSION_NAME)?.value;
  const sessao = await verificarTokenSessao(tokenBruto);

  if (isApi) {
    if (!sessao) {
      const resApi = NextResponse.json(
        { error: "Não autenticado. Faça login novamente." },
        { status: 401 }
      );
      if (tokenBruto) {
        resApi.cookies.set(COOKIE_SESSION_NAME, "", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 0,
        });
      }
      return resApi;
    }

    const exigeAdminApi =
      pathname.startsWith("/api/admin/logs-acesso") ||
      pathname.startsWith("/api/admin/homologacao") ||
      (pathname.startsWith("/api/admin/usuarios") && req.method === "GET");

    if (exigeAdminApi && sessao.perfilId !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso restrito ao Administrador." },
        { status: 403 }
      );
    }

    return NextResponse.next();
  }

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

    const loginUrl = new URL("/login", req.url);
    if (pathname && pathname !== "/" && !pathname.startsWith("/login")) {
      const destinoCompleto = `${pathname}${req.nextUrl.search || ""}`;
      loginUrl.searchParams.set("redirect", destinoCompleto);
    }
    const res = NextResponse.redirect(loginUrl);
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
    const redirectParam = (req.nextUrl.searchParams.get("redirect") || req.nextUrl.searchParams.get("next") || "").trim();
    if (
      redirectParam &&
      redirectParam.startsWith("/") &&
      !redirectParam.startsWith("//") &&
      !redirectParam.startsWith("/login")
    ) {
      return NextResponse.redirect(new URL(redirectParam, req.url));
    }
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
