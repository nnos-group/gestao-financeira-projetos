"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePerfilAcesso } from "@/contexts/PerfilAcessoContext";
import BotaoAjudaCentral from "@/components/BotaoAjudaCentral";
import ModalPerfilUsuario from "@/components/ModalPerfilUsuario";

interface UsuarioAtivoInfo {
  id?: string;
  login: string;
  nome: string;
  email: string;
  cargo: string;
  fotoUrl: string;
  perfilId?: string;
  mfaSecret?: string;
}

function formatarNomeTitulo(str: string): string {
  return String(str || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((p) => (p.length <= 2 && ["de", "da", "do", "e"].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

function obterIniciais(nome: string): string {
  const partes = String(nome || "NN")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return "NN";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export default function UserProfileHeader() {
  const router = useRouter();
  const { perfilAtivoId, perfilAtivoObj, liderSimulado, listaLideres } = usePerfilAcesso();
  const [mounted, setMounted] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [abaModal, setAbaModal] = useState<"FOTO" | "SENHA" | "MFA">("FOTO");
  const [fotosPorChave, setFotosPorChave] = useState<Record<string, string>>({});
  const [usuarioSessao, setUsuarioSessao] = useState<UsuarioAtivoInfo | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
    const carregarEstado = () => {
      try {
        const savedUser = localStorage.getItem("nnos_usuario_logado_v1");
        if (savedUser) {
          setUsuarioSessao(JSON.parse(savedUser));
        }
        const savedFotos = localStorage.getItem("nnos_fotos_usuarios_v1");
        if (savedFotos) {
          setFotosPorChave(JSON.parse(savedFotos));
        }
      } catch {}
    };

    carregarEstado();
    window.addEventListener("nnos-user-updated", carregarEstado);
    return () => window.removeEventListener("nnos-user-updated", carregarEstado);
  }, []);

  // Determina a identidade exibida no topo conforme o perfil/líder ativo ou usuário logado
  const identidadeAtiva: UsuarioAtivoInfo = React.useMemo(() => {
    // 1. Se há um usuário real autenticado que não seja ADMIN, sua própria identidade é soberana
    if (usuarioSessao && usuarioSessao.perfilId !== "ADMIN") {
      const chave = (usuarioSessao.login || usuarioSessao.nome || "nnos").toLowerCase();
      return {
        ...usuarioSessao,
        fotoUrl:
          fotosPorChave[chave] ||
          fotosPorChave[usuarioSessao.nome?.toUpperCase() || ""] ||
          usuarioSessao.fotoUrl ||
          "",
      };
    }

    // 2. Administrador simulando perfil LIDER
    if (perfilAtivoId === "LIDER" && liderSimulado && liderSimulado !== "TODOS") {
      const infoLider = listaLideres.find(
        (l) => l.nome.toUpperCase() === liderSimulado.toUpperCase()
      );
      const nomeFmt = formatarNomeTitulo(liderSimulado);
      const loginLider = liderSimulado
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, ".");
      const chaveFoto = loginLider;
      return {
        login: loginLider,
        nome: nomeFmt,
        email: infoLider?.email || `${loginLider}@nnos.com.br`,
        cargo: `Líder de Projeto • ${infoLider?.area || "Projetos"}`,
        fotoUrl:
          fotosPorChave[chaveFoto] ||
          fotosPorChave[liderSimulado.toUpperCase()] ||
          (usuarioSessao?.login === loginLider ? usuarioSessao.fotoUrl : "") ||
          "",
        mfaSecret: usuarioSessao?.mfaSecret || "JBSWY3DPEHPK3PXP",
      };
    }

    if (usuarioSessao && (perfilAtivoId === usuarioSessao.login || perfilAtivoId === "ADMIN")) {
      const chave = (usuarioSessao.login || usuarioSessao.nome || "nnos").toLowerCase();
      return {
        ...usuarioSessao,
        fotoUrl: fotosPorChave[chave] || usuarioSessao.fotoUrl || "",
      };
    }

    if (perfilAtivoId === "DIRETORIA") {
      const loginDir = (usuarioSessao?.perfilId === "DIRETORIA" && usuarioSessao.login) ? usuarioSessao.login : "marcelo.lara";
      return {
        login: loginDir,
        nome: usuarioSessao?.perfilId === "DIRETORIA" ? usuarioSessao.nome : "Marcelo Lara",
        email: usuarioSessao?.perfilId === "DIRETORIA" ? usuarioSessao.email : "marcelo.lara@nnos.com.br",
        cargo: usuarioSessao?.perfilId === "DIRETORIA" ? usuarioSessao.cargo : "Sócio Diretor Executivo • Diretoria",
        fotoUrl: fotosPorChave[loginDir] || (usuarioSessao?.perfilId === "DIRETORIA" ? usuarioSessao.fotoUrl : "") || "",
        mfaSecret: "MARCELO2026NNOS",
      };
    }

    if (perfilAtivoId === "FINANCEIRO") {
      return {
        login: "financeiro",
        nome: "Equipe Financeiro",
        email: "financeiro@nnos.com.br",
        cargo: "Financeiro & Controladoria",
        fotoUrl: fotosPorChave["financeiro"] || "",
        mfaSecret: "FINAN2026NNOSKEY",
      };
    }

    if (perfilAtivoId === "AGENCIA") {
      return {
        login: "agencia.fatima",
        nome: "Agência de Viagens FÁTIMA",
        email: "fcconsultoriadeviagens@gmail.com",
        cargo: "Operação de Cotações & Vouchers",
        fotoUrl: fotosPorChave["agencia.viagens"] || "",
        mfaSecret: "AGENC2026NNOSKEY",
      };
    }

    const chaveDefault = (usuarioSessao?.login || "leonardo.campos").toLowerCase();
    return {
      login: chaveDefault,
      nome: usuarioSessao?.nome || "Leonardo Campos",
      email: usuarioSessao?.email || "leonardo.campos@nnos.com.br",
      cargo: usuarioSessao?.cargo || `${perfilAtivoObj?.nome || "Administrador"} • Planejamento & Finanças`,
      fotoUrl: fotosPorChave[chaveDefault] || usuarioSessao?.fotoUrl || "",
      mfaSecret: usuarioSessao?.mfaSecret || "JBSWY3DPEHPK3PXP",
    };
  }, [perfilAtivoId, perfilAtivoObj, liderSimulado, listaLideres, usuarioSessao, fotosPorChave]);

  const handleSelecionarArquivoFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const maxDim = 220;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
        }
        const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
        await salvarFotoPerfil(dataUrl);
      };
      img.src = String(ev.target?.result || "");
    };
    reader.readAsDataURL(file);
  };

  const salvarFotoPerfil = async (novaFotoUrl: string) => {
    const chave = identidadeAtiva.login.toLowerCase();
    const novasFotos = {
      ...fotosPorChave,
      [chave]: novaFotoUrl,
      [identidadeAtiva.nome.toUpperCase()]: novaFotoUrl,
    };
    setFotosPorChave(novasFotos);

    try {
      localStorage.setItem("nnos_fotos_usuarios_v1", JSON.stringify(novasFotos));
      if (usuarioSessao) {
        const atualizado = { ...usuarioSessao, fotoUrl: novaFotoUrl };
        setUsuarioSessao(atualizado);
        localStorage.setItem("nnos_usuario_logado_v1", JSON.stringify(atualizado));
      }
      window.dispatchEvent(new CustomEvent("nnos-user-updated"));
    } catch {}

    try {
      await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "ATUALIZAR_FOTO",
          login: identidadeAtiva.login,
          nome: identidadeAtiva.nome,
          fotoUrl: novaFotoUrl,
        }),
      });
    } catch {}

    setFeedbackMsg({
      tipo: "ok",
      texto: novaFotoUrl ? "Foto de perfil atualizada com sucesso!" : "Foto removida com sucesso.",
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleSalvarNovaSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaSenha || novaSenha.trim().length < 4) {
      setFeedbackMsg({ tipo: "erro", texto: "A nova senha deve ter no mínimo 4 caracteres." });
      return;
    }
    if (novaSenha !== confirmaSenha) {
      setFeedbackMsg({ tipo: "erro", texto: "A confirmação de senha não confere." });
      return;
    }

    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "ALTERAR_SENHA",
          login: identidadeAtiva.login,
          novaSenha: novaSenha.trim(),
        }),
      });
      if (res.ok) {
        setNovaSenha("");
        setConfirmaSenha("");
        setFeedbackMsg({ tipo: "ok", texto: "Senha atualizada com sucesso!" });
        setTimeout(() => setFeedbackMsg(null), 3000);
      } else {
        setFeedbackMsg({ tipo: "erro", texto: "Não foi possível alterar a senha." });
      }
    } catch {
      setFeedbackMsg({ tipo: "erro", texto: "Erro de conexão ao salvar senha." });
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "LOGOUT",
          login: identidadeAtiva.login,
          nome: identidadeAtiva.nome,
          email: identidadeAtiva.email,
          perfilId: perfilAtivoId,
        }),
      });
    } catch {}
    try {
      localStorage.removeItem("nnos_usuario_logado_v1");
      localStorage.removeItem("nnos_perfil_ativo_id");
      localStorage.removeItem("nnos_consultor_simulado_id");
      localStorage.removeItem("nnos_consultor_simulado_nome");
      localStorage.removeItem("nnos_consultor_simulado_obj");
      localStorage.removeItem("nnos_lider_simulado_v1");
      window.dispatchEvent(new CustomEvent("nnos-user-updated"));
    } catch {}
    window.location.href = "/login";
  };

  const otpAuthUri = `otpauth://totp/NNOS:${encodeURIComponent(
    identidadeAtiva.email
  )}?secret=${identidadeAtiva.mfaSecret || "JBSWY3DPEHPK3PXP"}&issuer=NNOS%20Consultoria`;

  return (
    <>
      <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
        {/* Botão Oficial de Ajuda & Agente de IA */}
        <BotaoAjudaCentral />

        <button
          type="button"
          onClick={handleLogout}
          className="btn-header-logout"
          title="Encerrar sessão e ir para a tela de Login"
          style={{ cursor: "pointer" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
            logout
          </span>
          <span>Sair</span>
        </button>

        {/* Identificação do Usuário Logado + Avatar com Upload de Foto */}
        <div
          className="header-user"
          onClick={() => {
            setFeedbackMsg(null);
            setModalAberto(true);
          }}
          title="Clique para alterar sua foto de perfil, senha ou Google Authenticator"
          style={{
            cursor: "pointer",
            padding: "4px 8px 4px 12px",
            borderRadius: "12px",
            transition: "background-color 0.15s ease",
          }}
        >
          <div className="user-details" style={{ textAlign: "right" }}>
            <strong style={{ display: "block", fontSize: "12.5px", color: "var(--primary)", lineHeight: 1.2 }}>
              {identidadeAtiva.nome}
            </strong>
            <span style={{ display: "block", fontSize: "11px", color: "var(--on-surface-variant)", lineHeight: 1.2 }}>
              {identidadeAtiva.cargo}
            </span>
          </div>

          <div
            className="user-avatar"
            style={{
              position: "relative",
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              overflow: " visible",
              backgroundColor: "var(--primary)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "13px",
              border: "2px solid rgba(2, 132, 199, 0.35)",
              flexShrink: 0,
            }}
          >
            {identidadeAtiva.fotoUrl ? (
              <img
                src={identidadeAtiva.fotoUrl}
                alt={identidadeAtiva.nome}
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <span>{obterIniciais(identidadeAtiva.nome)}</span>
            )}
            <span
              style={{
                position: "absolute",
                bottom: "-2px",
                right: "-2px",
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                backgroundColor: "#0284c7",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1.5px solid #ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "10px" }}>
                photo_camera
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Modal Oficial de Perfil do Usuário (Foto, Senha e Google MFA) */}
      <ModalPerfilUsuario
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        identidade={identidadeAtiva}
        onFotoAtualizada={(novaFotoUrl) => {
          salvarFotoPerfil(novaFotoUrl);
        }}
      />
    </>
  );
}

