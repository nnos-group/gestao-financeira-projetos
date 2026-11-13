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
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch (e) {
    console.warn("Aviso ao ler usuarios_sistema no Supabase:", e);
  }
  return lerUsuarios();
}

export function salvarUsuarios(lista: any[]) {
  try {
    fs.writeFileSync(USUARIOS_PATH, JSON.stringify(lista, null, 2), "utf-8");
  } catch (e) {
    console.warn("Aviso ao gravar usuarios-sistema.json (FS read-only em serverless):", e);
  }
}

export async function salvarUsuariosAsync(lista: any[]) {
  salvarUsuarios(lista);
  try {
    const db = getSupabase();
    if (db) {
      await db.from("configuracoes").upsert(
        {
          chave: "usuarios_sistema",
          valor: lista.length,
          descricao: JSON.stringify(lista),
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
    return "123456";
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

