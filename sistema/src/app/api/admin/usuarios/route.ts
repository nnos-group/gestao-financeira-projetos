import { NextRequest, NextResponse } from "next/server";
import {
  lerUsuariosAsync,
  salvarUsuariosAsync,
  registrarLogSegurancaAsync,
  gerarCodigoTotp,
  gerarNovoSegredoBase32,
  gerarHashSenha,
  sanitizarUsuarioSemSegredos,
} from "@/lib/usuarios-service";
import { COOKIE_SESSION_NAME, verificarTokenSessao } from "@/lib/session-token";

async function obterSessao(req: NextRequest) {
  const token = req.cookies.get(COOKIE_SESSION_NAME)?.value;
  return verificarTokenSessao(token);
}

export async function GET(req: NextRequest) {
  try {
    const sessao = await obterSessao(req);
    if (!sessao) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (sessao.perfilId !== "ADMIN") {
      return NextResponse.json({ error: "Acesso restrito ao Administrador." }, { status: 403 });
    }

    const listaBase = await lerUsuariosAsync();
    const lista = listaBase.map((u) => ({
      ...sanitizarUsuarioSemSegredos(u),
      totpAtual: gerarCodigoTotp(u.mfaSecret || "JBSWY3DPEHPK3PXP"),
    }));
    return NextResponse.json({ usuarios: lista });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessao = await obterSessao(req);
    if (!sessao) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const isAdmin = sessao.perfilId === "ADMIN";
    const body = await req.json();
    const acao = body.acao || "CRIAR_OU_EDITAR";
    let usuarios = await lerUsuariosAsync();

    if (acao === "ATUALIZAR_FOTO") {
      const { id, login, nome, fotoUrl } = body;
      const mesmoUsuario =
        (id && String(id) === String(sessao.id)) ||
        (login && String(login).toLowerCase() === String(sessao.login).toLowerCase());

      if (!isAdmin && !mesmoUsuario) {
        return NextResponse.json(
          { error: "Você só pode alterar a foto da sua própria conta." },
          { status: 403 }
        );
      }

      let atualizado: any = null;
      usuarios = usuarios.map((u) => {
        const matchId = id && u.id === id;
        const matchLogin = login && String(u.login).toLowerCase() === String(login).toLowerCase();
        const matchNome = isAdmin && nome && String(u.nome).toLowerCase() === String(nome).toLowerCase();
        if (matchId || matchLogin || matchNome) {
          atualizado = { ...u, fotoUrl: fotoUrl || "" };
          return atualizado;
        }
        return u;
      });
      await salvarUsuariosAsync(usuarios);
      return NextResponse.json({
        ok: true,
        usuario: atualizado ? sanitizarUsuarioSemSegredos(atualizado) : null,
        ...(isAdmin ? { usuarios: usuarios.map(sanitizarUsuarioSemSegredos) } : {}),
      });
    }

    if (acao === "ALTERAR_SENHA") {
      const { id, login, novaSenha } = body;
      const mesmoUsuario =
        (id && String(id) === String(sessao.id)) ||
        (login && String(login).toLowerCase() === String(sessao.login).toLowerCase());

      if (!isAdmin && !mesmoUsuario) {
        return NextResponse.json(
          { error: "Você só pode alterar a senha da sua própria conta." },
          { status: 403 }
        );
      }

      if (!novaSenha || String(novaSenha).trim().length < 4) {
        return NextResponse.json({ error: "A senha deve ter ao menos 4 caracteres." }, { status: 400 });
      }
      const hashNovaSenha = gerarHashSenha(String(novaSenha).trim());
      let alvo: any = null;
      usuarios = usuarios.map((u) => {
        if (u.id === id || (login && String(u.login).toLowerCase() === String(login).toLowerCase())) {
          alvo = {
            ...u,
            senha: hashNovaSenha,
            status: u.status === "PENDENTE_SENHA" ? "ATIVO" : u.status,
          };
          return alvo;
        }
        return u;
      });
      await salvarUsuariosAsync(usuarios);
      if (alvo) {
        await registrarLogSegurancaAsync({
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
      return NextResponse.json({
        ok: true,
        usuario: alvo ? sanitizarUsuarioSemSegredos(alvo) : null,
        ...(isAdmin ? { usuarios: usuarios.map(sanitizarUsuarioSemSegredos) } : {}),
      });
    }

    // Demais operações administrativas exigem obrigatoriamente perfil ADMIN
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Acesso restrito ao Administrador." },
        { status: 403 }
      );
    }

    if (acao === "GERAR_NOVO_MFA") {
      const { id } = body;
      const novoSecret = gerarNovoSegredoBase32();
      let alvo: any = null;
      usuarios = usuarios.map((u) => {
        if (u.id === id) {
          alvo = { ...u, mfaAtivo: true, mfaSecret: novoSecret };
          return alvo;
        }
        return u;
      });
      await salvarUsuariosAsync(usuarios);
      if (alvo) {
        await registrarLogSegurancaAsync({
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
      const listaSanitizada = usuarios.map((u) => ({
        ...sanitizarUsuarioSemSegredos(u),
        totpAtual: gerarCodigoTotp(u.mfaSecret || "JBSWY3DPEHPK3PXP"),
      }));
      return NextResponse.json({
        ok: true,
        usuario: alvo
          ? { ...sanitizarUsuarioSemSegredos(alvo), totpAtual: gerarCodigoTotp(novoSecret) }
          : null,
        usuarios: listaSanitizada,
      });
    }

    if (acao === "EXCLUIR") {
      const { id } = body;
      const removido = usuarios.find((u) => u.id === id);
      usuarios = usuarios.filter((u) => u.id !== id);
      await salvarUsuariosAsync(usuarios);
      if (removido) {
        await registrarLogSegurancaAsync({
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
      return NextResponse.json({
        ok: true,
        usuarios: usuarios.map((u) => ({
          ...sanitizarUsuarioSemSegredos(u),
          totpAtual: gerarCodigoTotp(u.mfaSecret || "JBSWY3DPEHPK3PXP"),
        })),
      });
    }

    // CRIAR_OU_EDITAR
    const uData = body.usuario;
    if (!uData || !uData.nome || !uData.login) {
      return NextResponse.json({ error: "Nome e Login são obrigatórios." }, { status: 400 });
    }

    const existeIdx = usuarios.findIndex((u) => u.id === uData.id);
    if (existeIdx >= 0) {
      const atual = usuarios[existeIdx];
      const novaSenhaLimpa = typeof uData.senha === "string" ? uData.senha.trim() : "";
      if (novaSenhaLimpa && novaSenhaLimpa.length < 4) {
        return NextResponse.json({ error: "A nova senha deve ter ao menos 4 caracteres." }, { status: 400 });
      }
      const dadosLimpos = { ...uData };
      delete dadosLimpos.senha;
      delete dadosLimpos.senhaCriptografada;
      delete dadosLimpos.totpAtual;

      const editado = {
        ...atual,
        ...dadosLimpos,
        senha: novaSenhaLimpa ? gerarHashSenha(novaSenhaLimpa) : atual.senha,
        mfaSecret: uData.mfaSecret || atual.mfaSecret || gerarNovoSegredoBase32(),
      };
      usuarios[existeIdx] = editado;
      await salvarUsuariosAsync(usuarios);
      await registrarLogSegurancaAsync({
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
      const senhaInicial = String(uData.senha || "").trim();
      if (!senhaInicial || senhaInicial.length < 4) {
        return NextResponse.json(
          { error: "Informe uma senha inicial com ao menos 4 caracteres." },
          { status: 400 }
        );
      }
      const novo = {
        id: `usr-${Date.now()}`,
        login: String(uData.login).trim().toLowerCase(),
        nome: String(uData.nome).trim(),
        email: String(uData.email || `${uData.login}@nnos.com.br`).trim().toLowerCase(),
        cargo: String(uData.cargo || "Colaborador NNÓS").trim(),
        perfilId: uData.perfilId || "LIDER",
        liderVinculado: uData.liderVinculado || "TODOS",
        senha: gerarHashSenha(senhaInicial),
        mfaAtivo: Boolean(uData.mfaAtivo),
        mfaSecret: uData.mfaSecret || gerarNovoSegredoBase32(),
        status: uData.status || "ATIVO",
        fotoUrl: uData.fotoUrl || "",
        ultimoAcesso: new Date().toISOString(),
        criadoEm: new Date().toISOString(),
      };
      usuarios.push(novo);
      await salvarUsuariosAsync(usuarios);
      await registrarLogSegurancaAsync({
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
      ...sanitizarUsuarioSemSegredos(u),
      totpAtual: gerarCodigoTotp(u.mfaSecret || "JBSWY3DPEHPK3PXP"),
    }));
    return NextResponse.json({ ok: true, usuarios: listaRetorno });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
