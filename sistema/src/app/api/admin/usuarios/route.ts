import { NextRequest, NextResponse } from "next/server";
import {
  lerUsuarios,
  salvarUsuarios,
  registrarLogSeguranca,
  gerarCodigoTotp,
  gerarNovoSegredoBase32,
} from "@/lib/usuarios-service";

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

