"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { usePerfilAcesso } from "@/contexts/PerfilAcessoContext";

type ModoTelaLogin = "PADRAO" | "MFA_GOOGLE" | "ESQUECI_SENHA";

export default function LoginPage() {
  const router = useRouter();
  const { ativarPerfil, setLiderSimulado } = usePerfilAcesso();

  const [modo, setModo] = useState<ModoTelaLogin>("PADRAO");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [codigoMfa, setCodigoMfa] = useState("");
  const [exibirCampoMfaNoPadrao, setExibirCampoMfaNoPadrao] = useState(true);
  const [exibirQrModal, setExibirQrModal] = useState(false);

  // Estados de "Esqueci Minha Senha"
  const [etapaRecuperacao, setEtapaRecuperacao] = useState<1 | 2>(1);
  const [identificadorRec, setIdentificadorRec] = useState("");
  const [codigoRec, setCodigoRec] = useState("");
  const [novaSenhaRec, setNovaSenhaRec] = useState("");
  const [confirmaSenhaRec, setConfirmaSenhaRec] = useState("");
  const [dicaCodigoDemo, setDicaCodigoDemo] = useState<string | null>(null);

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const autenticarSessao = (userObj: any) => {
    const perfilId = userObj.perfilId || "ADMIN";

    try {
      localStorage.setItem("nnos_usuario_logado_v1", JSON.stringify(userObj));
      localStorage.setItem("nnos_perfil_ativo_id", perfilId);
      if (userObj.fotoUrl) {
        const fotosAtuais = JSON.parse(localStorage.getItem("nnos_fotos_usuarios_v1") || "{}");
        fotosAtuais[String(userObj.login || "").toLowerCase()] = userObj.fotoUrl;
        fotosAtuais[String(userObj.nome || "").toUpperCase()] = userObj.fotoUrl;
        localStorage.setItem("nnos_fotos_usuarios_v1", JSON.stringify(fotosAtuais));
      }
      window.dispatchEvent(new CustomEvent("nnos-user-updated"));
    } catch {}

    // Determina a rota autorizada de destino conforme o perfil oficial
    let rotaDestino = "/projetos";
    if (perfilId === "CONSULTOR" || perfilId === "SOCIO") {
      rotaDestino = "/consultor";
      try {
        localStorage.setItem("nnos_consultor_simulado_nome", userObj.nome);
        localStorage.removeItem("nnos_consultor_simulado_id");
        localStorage.removeItem("nnos_consultor_simulado_obj");
      } catch {}
    } else if (perfilId === "AGENCIA") {
      rotaDestino = "/viagens";
    } else if (perfilId === "FINANCEIRO") {
      rotaDestino = "/medicao";
    }

    if (userObj.liderVinculado && userObj.liderVinculado !== "TODOS") {
      setLiderSimulado(userObj.liderVinculado);
    } else if (perfilId === "LIDER" && userObj.nome) {
      setLiderSimulado(userObj.nome);
    }

    ativarPerfil(perfilId, true);
    window.location.href = rotaDestino;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!usuario.trim()) {
      setErro("Informe seu usuário ou e-mail corporativo.");
      return;
    }

    if (modo === "MFA_GOOGLE" && codigoMfa.replace(/\D/g, "").length !== 6) {
      setErro("Informe os 6 dígitos do código MFA do Google Authenticator.");
      return;
    }

    if (modo === "PADRAO" && !senha.trim()) {
      setErro("Informe sua senha de acesso.");
      return;
    }

    try {
      setCarregando(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "LOGIN",
          usuario: usuario.trim(),
          senha: senha.trim(),
          codigoMfa: codigoMfa.replace(/\D/g, ""),
          modoSomenteMfa: modo === "MFA_GOOGLE",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Falha na autenticação. Verifique suas credenciais.");
        return;
      }

      autenticarSessao(data.usuario);
    } catch {
      setErro("Erro de comunicação com o servidor de autenticação.");
    } finally {
      setCarregando(false);
    }
  };

  const handleSolicitarRecuperacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    const idAlvo = (identificadorRec || usuario).trim();
    if (!idAlvo) {
      setErro("Digite seu usuário ou e-mail corporativo.");
      return;
    }

    try {
      setCarregando(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "SOLICITAR_RECUPERACAO",
          identificador: idAlvo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Usuário não localizado.");
        return;
      }
      setIdentificadorRec(idAlvo);
      setDicaCodigoDemo(data.codigoDemo || "123456");
      setEtapaRecuperacao(2);
      setSucesso(data.mensagem);
    } catch {
      setErro("Erro ao solicitar recuperação de senha.");
    } finally {
      setCarregando(false);
    }
  };

  const handleRedefinirSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (codigoRec.replace(/\D/g, "").length !== 6) {
      setErro("Informe o código de 6 dígitos (Google Authenticator ou token de recuperação).");
      return;
    }
    if (!novaSenhaRec || novaSenhaRec.length < 4) {
      setErro("A nova senha deve ter ao menos 4 caracteres.");
      return;
    }
    if (novaSenhaRec !== confirmaSenhaRec) {
      setErro("A confirmação de senha não confere.");
      return;
    }

    try {
      setCarregando(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "REDEFINIR_SENHA",
          identificador: identificadorRec,
          codigo: codigoRec.replace(/\D/g, ""),
          novaSenha: novaSenhaRec,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Não foi possível redefinir a senha.");
        return;
      }

      setUsuario(identificadorRec);
      setSenha(novaSenhaRec);
      setModo("PADRAO");
      setEtapaRecuperacao(1);
      setSucesso("Senha atualizada com sucesso! Clique em 'Entrar no Sistema' para continuar.");
    } catch {
      setErro("Erro ao salvar nova senha.");
    } finally {
      setCarregando(false);
    }
  };

  const otpAuthDemoUri = `otpauth://totp/NNOS:${encodeURIComponent(
    usuario || "nnos"
  )}?secret=JBSWY3DPEHPK3PXP&issuer=NNOS%20Consultoria`;

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        backgroundColor: "#edf2f7",
        backgroundImage:
          "radial-gradient(ellipse at 50% 15%, #ffffff 0%, #eaf0f8 55%, #dde7f2 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans', sans-serif)",
      }}
    >
      {/* Card Central no Padrão Clean do Print 3 */}
      <div
        style={{
          width: "100%",
          maxWidth: "445px",
          background: "#ffffff",
          borderRadius: "24px",
          padding: "38px 36px 28px",
          boxShadow:
            "0 20px 50px rgba(15, 42, 74, 0.08), 0 4px 16px rgba(15, 42, 74, 0.04), 0 0 0 1px rgba(226, 232, 240, 0.85)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
        }}
      >
        {/* Logomarca Imponente (Padrão Print 2 & 3) */}
        <img
          src="/logo-horizontal.png"
          alt="NNÓS - Transformando Estratégias em Realidade"
          style={{
            height: "82px",
            width: "auto",
            objectFit: "contain",
            marginBottom: "16px",
            filter: "drop-shadow(0 2px 6px rgba(15, 42, 74, 0.06))",
          }}
        />

        {/* Badge Ambiente Seguro / Acesso Restrito */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "5px 16px",
            borderRadius: "999px",
            backgroundColor: "rgba(2, 132, 199, 0.08)",
            border: "1px solid #bae6fd",
            color: "#0284c7",
            fontSize: "10.5px",
            fontWeight: 800,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginBottom: "16px",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
            verified_user
          </span>
          <span>AMBIENTE SEGURO • ACESSO RESTRITO</span>
        </div>

        {/* Título Principal */}
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 800,
            color: "#0f172a",
            margin: "0 0 20px 0",
            letterSpacing: "-0.02em",
            textAlign: "center",
          }}
        >
          Sistema Gestão NNÓS
        </h1>

        {/* Seletor Rápido de Método de Entrada (Credenciais vs Código MFA Google) */}
        {modo !== "ESQUECI_SENHA" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px",
              width: "100%",
              padding: "4px",
              borderRadius: "12px",
              backgroundColor: "#e2e8f0",
              marginBottom: "18px",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setErro(null);
                setModo("PADRAO");
              }}
              style={{
                padding: "8px 10px",
                borderRadius: "9px",
                border: "none",
                backgroundColor: modo === "PADRAO" ? "#ffffff" : "transparent",
                color: modo === "PADRAO" ? "#0f172a" : "#475569",
                fontSize: "11.5px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: modo === "PADRAO" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#0284c7" }}>
                password
              </span>
              <span>Senha + MFA</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setErro(null);
                setModo("MFA_GOOGLE");
              }}
              style={{
                padding: "8px 10px",
                borderRadius: "9px",
                border: "none",
                backgroundColor: modo === "MFA_GOOGLE" ? "#ffffff" : "transparent",
                color: modo === "MFA_GOOGLE" ? "#0f172a" : "#475569",
                fontSize: "11.5px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: modo === "MFA_GOOGLE" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#2563eb" }}>
                phonelink_lock
              </span>
              <span>Google Authenticator</span>
            </button>
          </div>
        )}

        {/* Alertas de Erro ou Sucesso */}
        {erro && (
          <div
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "10px",
              backgroundColor: "#fee2e2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: "12px",
              fontWeight: 600,
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "17px", flexShrink: 0 }}>
              error
            </span>
            <span>{erro}</span>
          </div>
        )}

        {sucesso && (
          <div
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "10px",
              backgroundColor: "#dcfce7",
              border: "1px solid #bbf7d0",
              color: "#166534",
              fontSize: "12px",
              fontWeight: 600,
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "17px", flexShrink: 0 }}>
              check_circle
            </span>
            <span>{sucesso}</span>
          </div>
        )}

        {/* MODO 1 e 2: LOGIN PADRÃO OU LOGIN DIRETO COM GOOGLE AUTHENTICATOR */}
        {modo !== "ESQUECI_SENHA" ? (
          <form onSubmit={handleLogin} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Campo USUÁRIO */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "10.5px",
                  fontWeight: 800,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "6px",
                }}
              >
                USUÁRIO OU E-MAIL
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  backgroundColor: "#edf4fc",
                  border: "1px solid #dbe7f5",
                  borderRadius: "11px",
                  padding: "10px 14px",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#64748b" }}>
                  person
                </span>
                <input
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="Ex: nnos ou nome.sobrenome"
                  style={{
                    width: "100%",
                    border: "none",
                    outline: "none",
                    backgroundColor: "transparent",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                />
              </div>
            </div>

            {/* Campo SENHA (exibido no modo PADRAO) */}
            {modo === "PADRAO" && (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "10.5px",
                      fontWeight: 800,
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    SENHA
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setErro(null);
                      setSucesso(null);
                      setIdentificadorRec(usuario);
                      setEtapaRecuperacao(1);
                      setModo("ESQUECI_SENHA");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "#0284c7",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      textDecoration: "none",
                    }}
                  >
                    Esqueci minha senha?
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    backgroundColor: "#edf4fc",
                    border: "1px solid #dbe7f5",
                    borderRadius: "11px",
                    padding: "10px 14px",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#64748b" }}>
                    key
                  </span>
                  <input
                    type={mostrarSenha ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      backgroundColor: "transparent",
                      fontSize: "13.5px",
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "#64748b",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                    title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>
                      {mostrarSenha ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Campo CÓDIGO MFA GOOGLE AUTHENTICATOR */}
            {(modo === "MFA_GOOGLE" || exibirCampoMfaNoPadrao) && (
              <div
                style={{
                  backgroundColor: "#f0f7ff",
                  border: "1px solid #bae6fd",
                  borderRadius: "12px",
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                  }}
                >
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "10.5px",
                      fontWeight: 800,
                      color: "#0369a1",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                      security
                    </span>
                    <span>CÓDIGO MFA • GOOGLE AUTHENTICATOR</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setExibirQrModal(!exibirQrModal)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "#0284c7",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {exibirQrModal ? "Ocultar QR Code" : "Parear App QR"}
                  </button>
                </div>

                {exibirQrModal && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      backgroundColor: "#ffffff",
                      padding: "10px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      marginBottom: "10px",
                    }}
                  >
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${encodeURIComponent(
                        otpAuthDemoUri
                      )}`}
                      alt="QR Code Google Authenticator"
                      style={{ width: "76px", height: "76px", borderRadius: "6px", flexShrink: 0 }}
                    />
                    <div style={{ fontSize: "11px", color: "#334155", lineHeight: 1.35 }}>
                      <strong style={{ display: "block", color: "#0f172a", marginBottom: "2px" }}>
                        Google Authenticator (TOTP)
                      </strong>
                      Escaneie com o app no celular ou utilize o código de validação{" "}
                      <code
                        onClick={() => setCodigoMfa("123456")}
                        style={{
                          backgroundColor: "#e0f2fe",
                          color: "#0369a1",
                          padding: "1px 5px",
                          borderRadius: "4px",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                        title="Clique para preencher"
                      >
                        123456
                      </code>
                      .
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #bae6fd",
                    borderRadius: "10px",
                    padding: "9px 12px",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#0284c7" }}>
                    pin
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={codigoMfa}
                    onChange={(e) => setCodigoMfa(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder={
                      modo === "MFA_GOOGLE"
                        ? "Digite os 6 dígitos do Google Authenticator"
                        : "Código 6 dígitos (opcional ou 123456)"
                    }
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      backgroundColor: "transparent",
                      fontSize: "14px",
                      fontWeight: 800,
                      letterSpacing: codigoMfa ? "0.22em" : "normal",
                      color: "#0f172a",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Botão Entrar no Sistema */}
            <button
              type="submit"
              disabled={carregando}
              style={{
                marginTop: "4px",
                width: "100%",
                padding: "13px 20px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(90deg, #0ea5e9 0%, #2563eb 100%)",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 800,
                cursor: carregando ? "wait" : "pointer",
                boxShadow: "0 8px 20px rgba(37, 99, 235, 0.32)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "transform 0.15s ease",
              }}
            >
              <span>{carregando ? "Autenticando..." : "Entrar no Sistema"}</span>
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                arrow_forward
              </span>
            </button>
          </form>
        ) : (
          /* MODO 3: FLUXO ESQUECI MINHA SENHA */
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: "12px",
                color: "#475569",
                lineHeight: 1.4,
              }}
            >
              <strong style={{ color: "#0f172a", display: "block", marginBottom: "2px" }}>
                Recuperação de Credencial Corporativa
              </strong>
              {etapaRecuperacao === 1
                ? "Informe seu usuário ou e-mail @nnos.com.br para receber o código de verificação."
                : "Informe o código de 6 dígitos (ou código do Google Authenticator) e defina sua nova senha."}
            </div>

            {etapaRecuperacao === 1 ? (
              <form onSubmit={handleSolicitarRecuperacao} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "10.5px",
                      fontWeight: 800,
                      color: "#475569",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    USUÁRIO OU E-MAIL CORPORATIVO
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      backgroundColor: "#edf4fc",
                      border: "1px solid #dbe7f5",
                      borderRadius: "11px",
                      padding: "10px 14px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#64748b" }}>
                      mail
                    </span>
                    <input
                      type="text"
                      value={identificadorRec}
                      onChange={(e) => setIdentificadorRec(e.target.value)}
                      placeholder="Ex: leonardo.campos@nnos.com.br"
                      style={{
                        width: "100%",
                        border: "none",
                        outline: "none",
                        backgroundColor: "transparent",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#0f172a",
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={carregando}
                  style={{
                    width: "100%",
                    padding: "12px 18px",
                    borderRadius: "11px",
                    border: "none",
                    background: "linear-gradient(90deg, #0ea5e9 0%, #2563eb 100%)",
                    color: "#ffffff",
                    fontSize: "13.5px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {carregando ? "Enviando..." : "Enviar Código de Recuperação"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRedefinirSenha} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {dicaCodigoDemo && (
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      backgroundColor: "#e0f2fe",
                      color: "#0369a1",
                      fontSize: "11.5px",
                      fontWeight: 600,
                    }}
                  >
                    Token TOTP gerado:{" "}
                    <strong
                      onClick={() => setCodigoRec(dicaCodigoDemo)}
                      style={{ cursor: "pointer", textDecoration: "underline" }}
                    >
                      {dicaCodigoDemo}
                    </strong>{" "}
                    (clique para preencher)
                  </div>
                )}

                <div>
                  <label style={{ display: "block", fontSize: "10.5px", fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: "4px" }}>
                    CÓDIGO DE 6 DÍGITOS (TOKEN OU GOOGLE AUTHENTICATOR)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={codigoRec}
                    onChange={(e) => setCodigoRec(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      backgroundColor: "#ffffff",
                      fontSize: "14px",
                      fontWeight: 800,
                      letterSpacing: "0.2em",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "10.5px", fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: "4px" }}>
                    NOVA SENHA
                  </label>
                  <input
                    type="password"
                    value={novaSenhaRec}
                    onChange={(e) => setNovaSenhaRec(e.target.value)}
                    placeholder="Mínimo de 4 caracteres"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      backgroundColor: "#ffffff",
                      fontSize: "13px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "10.5px", fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: "4px" }}>
                    CONFIRMAR NOVA SENHA
                  </label>
                  <input
                    type="password"
                    value={confirmaSenhaRec}
                    onChange={(e) => setConfirmaSenhaRec(e.target.value)}
                    placeholder="Repita a nova senha"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      backgroundColor: "#ffffff",
                      fontSize: "13px",
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={carregando}
                  style={{
                    width: "100%",
                    padding: "12px 18px",
                    borderRadius: "11px",
                    border: "none",
                    backgroundColor: "#059669",
                    color: "#ffffff",
                    fontSize: "13.5px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {carregando ? "Redefinindo..." : "Confirmar Nova Senha"}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => {
                setErro(null);
                setSucesso(null);
                setModo("PADRAO");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#475569",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                marginTop: "4px",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                arrow_back
              </span>
              <span>Voltar para o Login</span>
            </button>
          </div>
        )}

        {/* Rodapé Institucional do Card */}
        <div
          style={{
            marginTop: "22px",
            paddingTop: "14px",
            borderTop: "1px solid #e2e8f0",
            width: "100%",
            textAlign: "center",
            fontSize: "11px",
            color: "#64748b",
            fontWeight: 600,
          }}
        >
          NNÓS Gestão Financeira • Informações Confidenciais
        </div>
      </div>
    </div>
  );
}

