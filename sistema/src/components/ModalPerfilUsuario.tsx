"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface IdentidadeUsuarioModal {
  id?: string;
  login: string;
  nome: string;
  email: string;
  cargo: string;
  fotoUrl?: string;
  mfaSecret?: string;
}

interface ModalPerfilUsuarioProps {
  aberto: boolean;
  onFechar: () => void;
  identidade: IdentidadeUsuarioModal;
  onFotoAtualizada?: (novaFotoUrl: string) => void;
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

export default function ModalPerfilUsuario({
  aberto,
  onFechar,
  identidade,
  onFotoAtualizada,
}: ModalPerfilUsuarioProps) {
  const [mounted, setMounted] = useState(false);
  const [abaModal, setAbaModal] = useState<"FOTO" | "SENHA" | "MFA">("FOTO");
  const [fotoAtual, setFotoAtual] = useState<string>(identidade.fotoUrl || "");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setFotoAtual(identidade.fotoUrl || "");
  }, [identidade.fotoUrl]);

  useEffect(() => {
    if (aberto) {
      setFeedbackMsg(null);
      setNovaSenha("");
      setConfirmaSenha("");
    }
  }, [aberto]);

  if (!aberto || !mounted || typeof document === "undefined") {
    return null;
  }

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
    try {
      setSalvando(true);
      const chave = identidade.login.toLowerCase();
      let fotosAtuais: Record<string, string> = {};
      try {
        const raw = localStorage.getItem("nnos_fotos_usuarios_v1");
        if (raw) fotosAtuais = JSON.parse(raw);
      } catch {}

      const novasFotos = {
        ...fotosAtuais,
        [chave]: novaFotoUrl,
        [identidade.nome.toUpperCase()]: novaFotoUrl,
      };
      setFotoAtual(novaFotoUrl);

      try {
        localStorage.setItem("nnos_fotos_usuarios_v1", JSON.stringify(novasFotos));
        const savedUser = localStorage.getItem("nnos_usuario_logado_v1");
        if (savedUser) {
          const userObj = JSON.parse(savedUser);
          if (userObj.login === identidade.login || userObj.nome === identidade.nome) {
            userObj.fotoUrl = novaFotoUrl;
            localStorage.setItem("nnos_usuario_logado_v1", JSON.stringify(userObj));
          }
        }
        window.dispatchEvent(new CustomEvent("nnos-user-updated"));
      } catch {}

      try {
        await fetch("/api/admin/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            acao: "ATUALIZAR_FOTO",
            id: identidade.id,
            login: identidade.login,
            nome: identidade.nome,
            fotoUrl: novaFotoUrl,
          }),
        });
      } catch {}

      if (onFotoAtualizada) {
        onFotoAtualizada(novaFotoUrl);
      }

      setFeedbackMsg({
        tipo: "ok",
        texto: novaFotoUrl ? "Foto de perfil atualizada com sucesso!" : "Foto removida com sucesso.",
      });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } finally {
      setSalvando(false);
    }
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
      setSalvando(true);
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "ALTERAR_SENHA",
          id: identidade.id,
          login: identidade.login,
          novaSenha: novaSenha.trim(),
        }),
      });
      if (res.ok) {
        setNovaSenha("");
        setConfirmaSenha("");
        setFeedbackMsg({ tipo: "ok", texto: "Senha corporativa atualizada com sucesso!" });
        setTimeout(() => setFeedbackMsg(null), 3500);
      } else {
        const data = await res.json().catch(() => ({}));
        setFeedbackMsg({ tipo: "erro", texto: data.error || "Não foi possível alterar a senha." });
      }
    } catch {
      setFeedbackMsg({ tipo: "erro", texto: "Erro de conexão ao salvar senha." });
    } finally {
      setSalvando(false);
    }
  };

  const otpAuthUri = `otpauth://totp/NNOS:${encodeURIComponent(
    identidade.email
  )}?secret=${identidade.mfaSecret || "JBSWY3DPEHPK3PXP"}&issuer=NNOS%20Consultoria`;

  return createPortal(
    <div
      onClick={onFechar}
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
              {fotoAtual ? (
                <img
                  src={fotoAtual}
                  alt={identidade.nome}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span>{obterIniciais(identidade.nome)}</span>
              )}
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 800 }}>{identidade.nome}</div>
              <div style={{ fontSize: "12px", color: "#93c5fd" }}>{identidade.email}</div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.75)", marginTop: "2px" }}>
                {identidade.cargo}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
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
            title="Fechar"
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
        <div
          style={{
            padding: "22px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            overflowY: "auto",
            flex: 1,
            minHeight: 0,
          }}
        >
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
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
                textAlign: "center",
              }}
            >
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
                title="Clique para escolher uma imagem"
              >
                {fotoAtual ? (
                  <img
                    src={fotoAtual}
                    alt={identidade.nome}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      color: "var(--on-surface-variant)",
                    }}
                  >
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
                Personalize sua identificação no Portal Corporativo NNÓS. Sua foto aparecerá no cabeçalho e nos
                registros do sistema.
              </div>

              <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "center" }}>
                <button
                  type="button"
                  disabled={salvando}
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
                    cursor: salvando ? "wait" : "pointer",
                    opacity: salvando ? 0.7 : 1,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>
                    upload
                  </span>
                  <span>{salvando ? "Salvando..." : "Escolher Foto do Computador"}</span>
                </button>

                {fotoAtual && (
                  <button
                    type="button"
                    disabled={salvando}
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
                      cursor: salvando ? "wait" : "pointer",
                      opacity: salvando ? 0.7 : 1,
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
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--on-surface-variant)",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                  }}
                >
                  Nova Senha Corporativa
                </label>
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Digite a nova senha..."
                  required
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
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--on-surface-variant)",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                  }}
                >
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  value={confirmaSenha}
                  onChange={(e) => setConfirmaSenha(e.target.value)}
                  placeholder="Repita a nova senha..."
                  required
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
                disabled={salvando}
                style={{
                  marginTop: "6px",
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: "#059669",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: salvando ? "wait" : "pointer",
                  opacity: salvando ? 0.7 : 1,
                }}
              >
                {salvando ? "Gravando Senha..." : "Salvar Nova Senha"}
              </button>
            </form>
          )}

          {abaModal === "MFA" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                textAlign: "center",
              }}
            >
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
                {identidade.mfaSecret || "JBSWY3DPEHPK3PXP"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
