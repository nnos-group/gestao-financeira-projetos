import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import usuariosPadrao from "@/lib/usuarios-sistema.json";

const USUARIOS_PATH = path.join(process.cwd(), "src", "lib", "usuarios-sistema.json");
const LOGS_PATH = path.join(process.cwd(), "src", "lib", "logs-acesso.json");

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

export function salvarUsuarios(lista: any[]) {
  try {
    fs.writeFileSync(USUARIOS_PATH, JSON.stringify(lista, null, 2), "utf-8");
  } catch (e) {
    console.warn("Aviso ao gravar usuarios-sistema.json:", e);
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
  try {
    let logs: any[] = [];
    if (fs.existsSync(LOGS_PATH)) {
      logs = JSON.parse(fs.readFileSync(LOGS_PATH, "utf-8"));
    }
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
    fs.writeFileSync(LOGS_PATH, JSON.stringify(logs.slice(0, 300), null, 2), "utf-8");
  } catch (e) {
    console.warn("Aviso ao registrar log de acesso:", e);
  }
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

function gerarNovoSegredoBase32(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let s = "";
  for (let i = 0; i < 16; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

export async function GET() {
  try {
    const lista = lerUsuarios().map((u) => ({
      ...u,
      totpAtual: gerarCodigoTotp(u.mfaSecret || "JBSWY3DPEHPK3PXP"),
    }));
    return NextResponse.json({ usuarios: lista });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const acao = body.acao || "CRIAR_OU_EDITAR";
    let usuarios = lerUsuarios();

    if (acao === "ATUALIZAR_FOTO") {
      const { id, login, nome, fotoUrl } = body;
      let atualizado: any = null;
      usuarios = usuarios.map((u) => {
        const matchId = id && u.id === id;
        const matchLogin = login && String(u.login).toLowerCase() === String(login).toLowerCase();
        const matchNome = nome && String(u.nome).toLowerCase() === String(nome).toLowerCase();
        if (matchId || matchLogin || matchNome) {
          atualizado = { ...u, fotoUrl: fotoUrl || "" };
          return atualizado;
        }
        return u;
      });
      salvarUsuarios(usuarios);
      return NextResponse.json({ ok: true, usuario: atualizado, usuarios });
    }

    if (acao === "ALTERAR_SENHA") {
      const { id, login, novaSenha } = body;
      if (!novaSenha || String(novaSenha).trim().length < 4) {
        return NextResponse.json({ error: "A senha deve ter ao menos 4 caracteres." }, { status: 400 });
      }
      let alvo: any = null;
      usuarios = usuarios.map((u) => {
        if (u.id === id || (login && String(u.login).toLowerCase() === String(login).toLowerCase())) {
          alvo = { ...u, senha: String(novaSenha).trim(), status: u.status === "PENDENTE_SENHA" ? "ATIVO" : u.status };
          return alvo;
        }
        return u;
      });
      salvarUsuarios(usuarios);
      if (alvo) {
        registrarLogSeguranca({
          usuarioLogin: alvo.login,
          usuarioNome: alvo.nome,
          usuarioEmail: alvo.email,
          perfilId: alvo.perfilId,
          evento: "ALTERACAO_SENHA",
          metodo: "Gestão de Credenciais",
          status: "SUCESSO",
          detalhes: `Senha do usuário ${alvo.nome} atualizada com sucesso.`,
        });
      }
      return NextResponse.json({ ok: true, usuario: alvo, usuarios });
    }

    if (acao === "GERAR_NOVO_MFA") {
      const { id } = body;
      const novoSecret = gerarNovoSegredoBase32();
      let alvo: any = null;
      usuarios = usuarios.map((u) => {
        if (u.id === id) {
          alvo = { ...u, mfaAtivo: true, mfaSecret: novoSecret, totpAtual: gerarCodigoTotp(novoSecret) };
          return alvo;
        }
        return u;
      });
      salvarUsuarios(usuarios);
      if (alvo) {
        registrarLogSeguranca({
          usuarioLogin: alvo.login,
          usuarioNome: alvo.nome,
          usuarioEmail: alvo.email,
          perfilId: alvo.perfilId,
          evento: "CONFIGURACAO_MFA",
          metodo: "Google Authenticator (TOTP)",
          status: "SUCESSO",
          detalhes: `Chave MFA Google Authenticator regenerada para ${alvo.nome}.`,
        });
      }
      return NextResponse.json({ ok: true, usuario: alvo, usuarios });
    }

    if (acao === "EXCLUIR") {
      const { id } = body;
      const removido = usuarios.find((u) => u.id === id);
      usuarios = usuarios.filter((u) => u.id !== id);
      salvarUsuarios(usuarios);
      if (removido) {
        registrarLogSeguranca({
          usuarioLogin: removido.login,
          usuarioNome: removido.nome,
          usuarioEmail: removido.email,
          perfilId: removido.perfilId,
          evento: "EXCLUSAO_USUARIO",
          metodo: "Painel do Administrador",
          status: "ALERTA",
          detalhes: `Conta do usuário ${removido.nome} (${removido.email}) removida pelo Administrador.`,
        });
      }
      return NextResponse.json({ ok: true, usuarios });
    }

    // CRIAR_OU_EDITAR
    const uData = body.usuario;
    if (!uData || !uData.nome || !uData.login) {
      return NextResponse.json({ error: "Nome e Login são obrigatórios." }, { status: 400 });
    }

    const existeIdx = usuarios.findIndex((u) => u.id === uData.id);
    if (existeIdx >= 0) {
      const atual = usuarios[existeIdx];
      const editado = {
        ...atual,
        ...uData,
        senha: uData.senha ? uData.senha : atual.senha,
        mfaSecret: uData.mfaSecret || atual.mfaSecret || gerarNovoSegredoBase32(),
      };
      usuarios[existeIdx] = editado;
      salvarUsuarios(usuarios);
      registrarLogSeguranca({
        usuarioLogin: editado.login,
        usuarioNome: editado.nome,
        usuarioEmail: editado.email,
        perfilId: editado.perfilId,
        evento: "ATUALIZACAO_CADASTRO",
        metodo: "Painel do Administrador",
        status: "SUCESSO",
        detalhes: `Cadastro/permissões de ${editado.nome} atualizados (Perfil: ${editado.perfilId} | Status: ${editado.status}).`,
      });
    } else {
      const novo = {
        id: `usr-${Date.now()}`,
        login: String(uData.login).trim().toLowerCase(),
        nome: String(uData.nome).trim(),
        email: String(uData.email || `${uData.login}@nnos.com.br`).trim().toLowerCase(),
        cargo: String(uData.cargo || "Colaborador NNÓS").trim(),
        perfilId: uData.perfilId || "LIDER",
        liderVinculado: uData.liderVinculado || "TODOS",
        senha: String(uData.senha || "nnos2026").trim(),
        mfaAtivo: Boolean(uData.mfaAtivo),
        mfaSecret: uData.mfaSecret || gerarNovoSegredoBase32(),
        status: uData.status || "ATIVO",
        fotoUrl: uData.fotoUrl || "",
        ultimoAcesso: new Date().toISOString(),
        criadoEm: new Date().toISOString(),
      };
      usuarios.push(novo);
      salvarUsuarios(usuarios);
      registrarLogSeguranca({
        usuarioLogin: novo.login,
        usuarioNome: novo.nome,
        usuarioEmail: novo.email,
        perfilId: novo.perfilId,
        evento: "CRIACAO_USUARIO",
        metodo: "Painel do Administrador",
        status: "SUCESSO",
        detalhes: `Novo usuário ${novo.nome} (${novo.email}) cadastrado no perfil ${novo.perfilId}.`,
      });
    }

    const listaRetorno = usuarios.map((u) => ({
      ...u,
      totpAtual: gerarCodigoTotp(u.mfaSecret || "JBSWY3DPEHPK3PXP"),
    }));
    return NextResponse.json({ ok: true, usuarios: listaRetorno });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

