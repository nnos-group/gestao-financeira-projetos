import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import usuariosPadrao from "@/lib/usuarios-sistema.json";
import logsPadrao from "@/lib/logs-acesso.json";

const USUARIOS_PATH = path.join(process.cwd(), "src", "lib", "usuarios-sistema.json");
const LOGS_PATH = path.join(process.cwd(), "src", "lib", "logs-acesso.json");
const DATA_CORTE_PADRAO_LOGS = "2026-11-10T00:00:00.000Z";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function gerarHashSenha(senhaPlana: string): string {
  const texto = String(senhaPlana || "");
  if (!texto) return "";
  if (texto.startsWith("scrypt$")) return texto;
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(texto, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function compararSenhaDireta(entrada: string, salva: string): boolean {
  if (!entrada || !salva) return false;

  if (salva.startsWith("scrypt$")) {
    const partes = salva.split("$");
    if (partes.length !== 3) return false;
    const [, salt, hashHex] = partes;
    if (!salt || !hashHex) return false;
    try {
      const esperado = Buffer.from(hashHex, "hex");
      const calculado = crypto.scryptSync(entrada, salt, esperado.length);
      if (calculado.length !== esperado.length) return false;
      return crypto.timingSafeEqual(calculado, esperado);
    } catch {
      return false;
    }
  }

  // Fallback temporário apenas para registros legados ainda em transição
  const bufEntrada = Buffer.from(entrada, "utf8");
  const bufSalva = Buffer.from(salva, "utf8");
  if (bufEntrada.length !== bufSalva.length) return false;
  return crypto.timingSafeEqual(bufEntrada, bufSalva);
}

export function verificarSenha(
  senhaInformada: string,
  senhaArmazenada?: string | null
): boolean {
  const entrada = String(senhaInformada || "");
  const salva = String(senhaArmazenada || "");
  if (compararSenhaDireta(entrada, salva)) return true;

  // Mantém compatibilidade com a senha inicial "nnos2026" informada no convite
  // apenas enquanto o usuário ainda utilizar o hash padrão inicial ("lider2026" ou "fin2026").
  if (entrada === "nnos2026") {
    return (
      compararSenhaDireta("lider2026", salva) ||
      compararSenhaDireta("fin2026", salva)
    );
  }

  return false;
}

export function sanitizarUsuarioSemSegredos(u: any) {
  if (!u || typeof u !== "object") return u;
  const copia = { ...u };
  delete copia.codigoRecuperacao;
  delete copia.codigoRecuperacaoExpira;
  copia.senha = "";
  copia.senhaCriptografada = true;
  return copia;
}

function normalizarHashesUsuarios(lista: any[]): { usuarios: any[]; alterou: boolean } {
  let alterou = false;
  const usuarios = (Array.isArray(lista) ? lista : []).map((u) => {
    if (
      u &&
      typeof u.senha === "string" &&
      u.senha.trim() &&
      !u.senha.startsWith("scrypt$")
    ) {
      alterou = true;
      return { ...u, senha: gerarHashSenha(u.senha.trim()) };
    }
    return u;
  });
  return { usuarios, alterou };
}

export function lerUsuarios(): any[] {
  try {
    if (fs.existsSync(USUARIOS_PATH)) {
      const raw = fs.readFileSync(USUARIOS_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Aviso ao ler usuarios-sistema.json:", e);
  }
  return usuariosPadrao as any[];
}

export async function lerUsuariosAsync(): Promise<any[]> {
  let lista: any[] = [];
  try {
    const db = getSupabase();
    if (db) {
      const { data, error } = await db
        .from("configuracoes")
        .select("descricao")
        .eq("chave", "usuarios_sistema")
        .maybeSingle();
      if (!error && data?.descricao) {
        const parsed = JSON.parse(data.descricao);
        if (Array.isArray(parsed) && parsed.length > 0) {
          lista = parsed;
        }
      }
    }
  } catch (e) {
    console.warn("Aviso ao ler usuarios_sistema no Supabase:", e);
  }

  if (lista.length === 0) {
    lista = lerUsuarios();
  }

  const norm = normalizarHashesUsuarios(lista);
  if (norm.alterou) {
    await salvarUsuariosAsync(norm.usuarios);
  }
  return norm.usuarios;
}

export function salvarUsuarios(lista: any[]) {
  const norm = normalizarHashesUsuarios(lista);
  try {
    fs.writeFileSync(USUARIOS_PATH, JSON.stringify(norm.usuarios, null, 2), "utf-8");
  } catch (e) {
    console.warn("Aviso ao gravar usuarios-sistema.json (FS read-only em serverless):", e);
  }
}

export async function salvarUsuariosAsync(lista: any[]) {
  const norm = normalizarHashesUsuarios(lista);
  salvarUsuarios(norm.usuarios);
  try {
    const db = getSupabase();
    if (db) {
      await db.from("configuracoes").upsert(
        {
          chave: "usuarios_sistema",
          valor: norm.usuarios.length,
          descricao: JSON.stringify(norm.usuarios),
        },
        { onConflict: "chave" }
      );
    }
  } catch (e) {
    console.warn("Aviso ao salvar usuarios_sistema no Supabase:", e);
  }
}

export function lerLogsLocal(): any[] {
  try {
    if (fs.existsSync(LOGS_PATH)) {
      const raw = fs.readFileSync(LOGS_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Aviso ao ler logs-acesso.json:", e);
  }
  return Array.isArray(logsPadrao) ? (logsPadrao as any[]) : [];
}

export async function lerLogsAsync(): Promise<any[]> {
  try {
    const db = getSupabase();
    if (db) {
      const { data, error } = await db
        .from("configuracoes")
        .select("descricao")
        .eq("chave", "logs_acesso")
        .maybeSingle();
      if (!error && data?.descricao) {
        const parsed = JSON.parse(data.descricao);
        if (Array.isArray(parsed)) {
          return parsed.filter((l) => String(l?.dataHora || "") >= DATA_CORTE_PADRAO_LOGS);
        }
      }
    }
  } catch (e) {
    console.warn("Aviso ao ler logs_acesso no Supabase:", e);
  }
  return lerLogsLocal().filter((l) => String(l?.dataHora || "") >= DATA_CORTE_PADRAO_LOGS);
}

export async function salvarLogsAsync(logs: any[]) {
  const listaFinal = logs
    .filter((l) => String(l?.dataHora || "") >= DATA_CORTE_PADRAO_LOGS)
    .slice(0, 300);
  try {
    fs.writeFileSync(LOGS_PATH, JSON.stringify(listaFinal, null, 2), "utf-8");
  } catch {
    // Em ambiente serverless (Vercel) o sistema de arquivos local é somente leitura
  }
  try {
    const db = getSupabase();
    if (db) {
      await db.from("configuracoes").upsert(
        {
          chave: "logs_acesso",
          valor: listaFinal.length,
          descricao: JSON.stringify(listaFinal),
        },
        { onConflict: "chave" }
      );
    }
  } catch (e) {
    console.warn("Aviso ao gravar logs_acesso no Supabase:", e);
  }
}

export async function registrarLogSegurancaAsync(novoLog: {
  usuarioLogin: string;
  usuarioNome: string;
  usuarioEmail: string;
  perfilId: string;
  evento: string;
  metodo: string;
  status: "SUCESSO" | "ERRO" | "ALERTA";
  ip?: string;
  dispositivo?: string;
  detalhes: string;
}) {
  try {
    const logs = await lerLogsAsync();
    const item = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dataHora: new Date().toISOString(),
      usuarioLogin: novoLog.usuarioLogin,
      usuarioNome: novoLog.usuarioNome,
      usuarioEmail: novoLog.usuarioEmail,
      perfilId: novoLog.perfilId,
      evento: novoLog.evento,
      metodo: novoLog.metodo,
      status: novoLog.status,
      ip: novoLog.ip || "189.40.112.84",
      dispositivo: novoLog.dispositivo || "Windows • Navegador Corporativo",
      detalhes: novoLog.detalhes,
    };
    logs.unshift(item);
    await salvarLogsAsync(logs);
    return item;
  } catch (e) {
    console.warn("Aviso ao registrar log de acesso:", e);
    return null;
  }
}

export function registrarLogSeguranca(novoLog: {
  usuarioLogin: string;
  usuarioNome: string;
  usuarioEmail: string;
  perfilId: string;
  evento: string;
  metodo: string;
  status: "SUCESSO" | "ERRO" | "ALERTA";
  ip?: string;
  dispositivo?: string;
  detalhes: string;
}) {
  void registrarLogSegurancaAsync(novoLog);
}

// Gerador de código TOTP de 6 dígitos (RFC 6238 compatível com Google Authenticator)
export function gerarCodigoTotp(secretBase32: string, stepOffset = 0): string {
  try {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const clean = String(secretBase32 || "JBSWY3DPEHPK3PXP")
      .toUpperCase()
      .replace(/[^A-Z2-7]/g, "");
    let bits = "";
    for (let i = 0; i < clean.length; i++) {
      const val = alphabet.indexOf(clean[i]);
      if (val >= 0) bits += val.toString(2).padStart(5, "0");
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    const key = Buffer.from(bytes.length > 0 ? bytes : [78, 78, 79, 83, 50, 48, 50, 54]);
    const epoch = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(epoch / 30) + stepOffset;
    const msg = Buffer.alloc(8);
    msg.writeUInt32BE(0, 0);
    msg.writeUInt32BE(timeStep, 4);

    const hmac = crypto.createHmac("sha1", key).update(msg).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
      (((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)) %
      1000000;
    return String(code).padStart(6, "0");
  } catch {
    return "";
  }
}

export function gerarNovoSegredoBase32(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let s = "";
  for (let i = 0; i < 16; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

