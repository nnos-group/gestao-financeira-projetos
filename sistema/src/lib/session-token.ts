/**
 * Utilitário de geração e verificação de token de sessão assinado (HMAC-SHA256).
 * Usa Web Crypto API (`crypto.subtle`) para funcionar tanto no Edge Runtime
 * (Next.js Middleware) quanto em API Routes / Server Components Node.js.
 */

export const COOKIE_SESSION_NAME = "nnos_session";
export const DURACAO_SESSAO_SEGUNDOS = 60 * 60 * 12; // 12 horas

export interface SessaoPayload {
  id: string;
  login: string;
  nome: string;
  email: string;
  cargo: string;
  perfilId: string;
  prestadorIdVinculado?: string;
  liderVinculado?: string;
  mfaAtivo?: boolean;
  iat: number;
  exp: number;
}

function obterSegredoSessao(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "nnos-gestao-session-secret-key-2026"
  );
}

function paraArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesParaBase64Url(bytes: Uint8Array): string {
  let binario = "";
  for (let i = 0; i < bytes.length; i++) {
    binario += String.fromCharCode(bytes[i]);
  }
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlParaBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const binario = atob(b64 + padding);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) {
    bytes[i] = binario.charCodeAt(i);
  }
  return bytes;
}

function comparacaoTempoConstante(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function importarChaveHmac(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const segredoBytes = encoder.encode(obterSegredoSessao());
  return crypto.subtle.importKey(
    "raw",
    paraArrayBuffer(segredoBytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

export async function criarTokenSessao(
  usuario: Omit<SessaoPayload, "iat" | "exp">,
  duracaoSegundos: number = DURACAO_SESSAO_SEGUNDOS
): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  // Mantém apenas campos compactos no cookie (< 4 KB; nunca inclui fotoUrl Base64)
  const payload: SessaoPayload = {
    id: String(usuario.id || ""),
    login: String(usuario.login || ""),
    nome: String(usuario.nome || ""),
    email: String(usuario.email || ""),
    cargo: String(usuario.cargo || ""),
    perfilId: String(usuario.perfilId || "CONSULTOR"),
    ...(usuario.prestadorIdVinculado ? { prestadorIdVinculado: String(usuario.prestadorIdVinculado) } : {}),
    ...(usuario.liderVinculado ? { liderVinculado: String(usuario.liderVinculado) } : {}),
    ...(usuario.mfaAtivo !== undefined ? { mfaAtivo: Boolean(usuario.mfaAtivo) } : {}),
    iat: agora,
    exp: agora + duracaoSegundos,
  };

  const encoder = new TextEncoder();
  const payloadB64 = bytesParaBase64Url(encoder.encode(JSON.stringify(payload)));
  const chave = await importarChaveHmac();
  const assinaturaBuf = await crypto.subtle.sign(
    "HMAC",
    chave,
    paraArrayBuffer(encoder.encode(payloadB64))
  );
  const assinaturaB64 = bytesParaBase64Url(new Uint8Array(assinaturaBuf));
  return `${payloadB64}.${assinaturaB64}`;
}

export async function verificarTokenSessao(
  token?: string | null
): Promise<SessaoPayload | null> {
  if (!token || typeof token !== "string") return null;

  try {
    const partes = token.split(".");
    if (partes.length !== 2) return null;

    const [payloadB64, assinaturaB64] = partes;
    if (!payloadB64 || !assinaturaB64) return null;

    const encoder = new TextEncoder();
    const chave = await importarChaveHmac();
    const assinaturaEsperadaBuf = await crypto.subtle.sign(
      "HMAC",
      chave,
      paraArrayBuffer(encoder.encode(payloadB64))
    );
    const assinaturaEsperada = new Uint8Array(assinaturaEsperadaBuf);
    const assinaturaRecebida = base64UrlParaBytes(assinaturaB64);

    if (!comparacaoTempoConstante(assinaturaRecebida, assinaturaEsperada)) {
      return null;
    }

    const payloadJson = new TextDecoder().decode(base64UrlParaBytes(payloadB64));
    const payload = JSON.parse(payloadJson) as SessaoPayload;

    if (
      !payload ||
      typeof payload.id !== "string" ||
      typeof payload.perfilId !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    const agora = Math.floor(Date.now() / 1000);
    if (payload.exp <= agora) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function obterRotaPadraoPerfil(perfilId?: string): string {
  const perfil = (perfilId || "").toUpperCase();
  if (perfil === "AGENCIA") return "/viagens";
  if (perfil === "CONSULTOR" || perfil === "SOCIO") return "/consultor";
  if (perfil === "FINANCEIRO") return "/medicao";
  return "/projetos";
}
