"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { usePerfilAcesso } from "@/contexts/PerfilAcessoContext";
import BotaoAjudaCentral from "@/components/BotaoAjudaCentral";

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
        login: "agencia.viagens",
        nome: "Agência de Viagens",
        email: "atendimento@agenciaviagens.com.br",
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
    router.push("/login");
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

      {/* Modal de Perfil do Usuário (Foto, Senha e Google Authenticator) */}
      {modalAberto && mounted && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => setModalAberto(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(6, 13, 30, 0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "460px",
              maxHeight: "min(680px, calc(100vh - 40px))",
              backgroundColor: "var(--surface-container-lowest, #ffffff)",
              borderRadius: "20px",
              border: "1px solid var(--border)",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.35)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              margin: "auto",
            }}
          >
            {/* Header do Modal */}
            <div
              style={{
                background: "linear-gradient(135deg, #00152f 0%, #0f2a4a 100%)",
                color: "#ffffff",
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "54px",
                    height: "54px",
                    borderRadius: "50%",
                    backgroundColor: "#0284c7",
                    border: "2px solid rgba(255,255,255,0.4)",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {identidadeAtiva.fotoUrl ? (
                    <img
                      src={identidadeAtiva.fotoUrl}
                      alt={identidadeAtiva.nome}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span>{obterIniciais(identidadeAtiva.nome)}</span>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 800 }}>{identidadeAtiva.nome}</div>
                  <div style={{ fontSize: "12px", color: "#93c5fd" }}>{identidadeAtiva.email}</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.75)", marginTop: "2px" }}>
                    {identidadeAtiva.cargo}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalAberto(false)}
                style={{
                  background: "rgba(255,255,255,0.12)",
                  border: "none",
                  color: "#ffffff",
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  close
                </span>
              </button>
            </div>

            {/* Abas do Modal */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                borderBottom: "1px solid var(--border)",
                backgroundColor: "var(--surface-container-low)",
                flexShrink: 0,
              }}
            >
              {[
                { id: "FOTO", label: "Foto do Perfil", icon: "photo_camera" },
                { id: "SENHA", label: "Alterar Senha", icon: "key" },
                { id: "MFA", label: "Google MFA", icon: "phonelink_lock" },
              ].map((t) => {
                const ativo = abaModal === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setFeedbackMsg(null);
                      setAbaModal(t.id as any);
                    }}
                    style={{
                      padding: "12px 8px",
                      border: "none",
                      borderBottom: ativo ? "2.5px solid #0284c7" : "2.5px solid transparent",
                      backgroundColor: ativo ? "var(--surface-container-lowest)" : "transparent",
                      color: ativo ? "var(--primary)" : "var(--on-surface-variant)",
                      fontSize: "12px",
                      fontWeight: ativo ? 800 : 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      {t.icon}
                    </span>
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Corpo do Modal */}
            <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto", flex: 1, minHeight: 0 }}>
              {feedbackMsg && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "10px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    backgroundColor: feedbackMsg.tipo === "ok" ? "#dcfce7" : "#fee2e2",
                    color: feedbackMsg.tipo === "ok" ? "#166534" : "#991b1b",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    {feedbackMsg.tipo === "ok" ? "check_circle" : "error"}
                  </span>
                  <span>{feedbackMsg.texto}</span>
                </div>
              )}

              {abaModal === "FOTO" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", textAlign: "center" }}>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: "110px",
                      height: "110px",
                      borderRadius: "50%",
                      backgroundColor: "var(--surface-container)",
                      border: "3px dashed #0284c7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    {identidadeAtiva.fotoUrl ? (
                      <img
                        src={identidadeAtiva.fotoUrl}
                        alt={identidadeAtiva.nome}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "var(--on-surface-variant)" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "34px", color: "#0284c7" }}>
                          add_a_photo
                        </span>
                        <span style={{ fontSize: "10px", fontWeight: 700, marginTop: "4px" }}>Enviar Foto</span>
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleSelecionarArquivoFoto}
                    style={{ display: "none" }}
                  />

                  <div style={{ fontSize: "12.5px", color: "var(--on-surface-variant)", maxWidth: "340px" }}>
                    Personalize sua identificação no Portal Corporativo NNÓS. Sua foto aparecerá no cabeçalho e nos registros do sistema.
                  </div>

                  <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "center" }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "9px 18px",
                        borderRadius: "10px",
                        border: "none",
                        backgroundColor: "#0284c7",
                        color: "#ffffff",
                        fontSize: "12.5px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>
                        upload
                      </span>
                      <span>Escolher Foto do Computador</span>
                    </button>

                    {identidadeAtiva.fotoUrl && (
                      <button
                        type="button"
                        onClick={() => salvarFotoPerfil("")}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "9px 14px",
                          borderRadius: "10px",
                          border: "1px solid var(--border)",
                          backgroundColor: "var(--surface-container-low)",
                          color: "#dc2626",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>
                          delete
                        </span>
                        <span>Remover</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {abaModal === "SENHA" && (
                <form onSubmit={handleSalvarNovaSenha} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", marginBottom: "4px", textTransform: "uppercase" }}>
                      Nova Senha Corporativa
                    </label>
                    <input
                      type="password"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      placeholder="Digite a nova senha..."
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--surface-container-low)",
                        fontSize: "13px",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", marginBottom: "4px", textTransform: "uppercase" }}>
                      Confirmar Nova Senha
                    </label>
                    <input
                      type="password"
                      value={confirmaSenha}
                      onChange={(e) => setConfirmaSenha(e.target.value)}
                      placeholder="Repita a nova senha..."
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--surface-container-low)",
                        fontSize: "13px",
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      marginTop: "6px",
                      padding: "10px 16px",
                      borderRadius: "10px",
                      border: "none",
                      backgroundColor: "#059669",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Salvar Nova Senha
                  </button>
                </form>
              )}

              {abaModal === "MFA" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "12.5px", color: "var(--on-surface-variant)" }}>
                    Escaneie o QR Code no aplicativo <strong>Google Authenticator</strong> ou insira a chave secreta abaixo:
                  </div>
                  <div
                    style={{
                      padding: "12px",
                      backgroundColor: "#ffffff",
                      borderRadius: "14px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(otpAuthUri)}`}
                      alt="QR Code Google Authenticator"
                      style={{ width: "140px", height: "140px", display: "block" }}
                    />
                  </div>
                  <div
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      backgroundColor: "var(--surface-container)",
                      fontFamily: "monospace",
                      fontSize: "13px",
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      color: "var(--primary)",
                    }}
                  >
                    {identidadeAtiva.mfaSecret || "JBSWY3DPEHPK3PXP"}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

