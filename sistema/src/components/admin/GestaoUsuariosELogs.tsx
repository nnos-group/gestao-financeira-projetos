"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import ModernDropdown from "@/components/ModernDropdown";
import { formatarDataHoraBR } from "@/lib/date-utils";

interface Props {
  modo: "GESTAO_USUARIOS" | "LOGS_ACESSO";
  perfis: any[];
  onToast: (msg: string) => void;
}

const OPCOES_LIDER_VINCULADO = [
  { value: "TODOS", label: "Visão Geral / Sem Restrição de Carteira" },
  { value: "BEATRIZ PICORELLI", label: "Beatriz Picorelli (HRD)" },
  { value: "CAROLINE AMIEVA", label: "Caroline Amieva (Business Solutions)" },
  { value: "JEFFERSON SOUZA", label: "Jefferson Souza (Dealer Development)" },
  { value: "VINICIUS SOUZA", label: "Vinicius Souza (Outsourcing CNH)" },
  { value: "FÁBIO CANASSA", label: "Fábio Canassa (Outsourcing Porsche)" },
  { value: "JOICE LAGE", label: "Joice Lage (Educação UVA)" },
  { value: "LEONARDO CAMPOS", label: "Leonardo Campos (Diretoria & Adm)" },
];

function obterIniciais(nome: string): string {
  const p = String(nome || "NN")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (p.length === 0) return "NN";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export default function GestaoUsuariosELogs({ modo, perfis, onToast }: Props) {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);

  // Filtros Gestão de Usuários
  const [buscaUsuario, setBuscaUsuario] = useState("");
  const [filtroPerfilUser, setFiltroPerfilUser] = useState("TODOS");
  const [filtroStatusUser, setFiltroStatusUser] = useState("TODOS");
  const [senhasVisiveis, setSenhasVisiveis] = useState<Record<string, boolean>>({});

  // Modal de Edição / Criação de Usuário
  const [modalUsuarioAberto, setModalUsuarioAberto] = useState(false);
  const [formUser, setFormUser] = useState<any>({
    id: "",
    login: "",
    nome: "",
    email: "",
    cargo: "",
    perfilId: "LIDER",
    liderVinculado: "TODOS",
    senha: "",
    mfaAtivo: true,
    mfaSecret: "",
    status: "ATIVO",
    fotoUrl: "",
  });

  // Modal de QR Code MFA Google Authenticator
  const [usuarioQrModal, setUsuarioQrModal] = useState<any | null>(null);
  const fileInputModalRef = useRef<HTMLInputElement | null>(null);

  // Filtros Log de Acesso
  const [buscaLog, setBuscaLog] = useState("");
  const [filtroStatusLog, setFiltroStatusLog] = useState("TODOS");
  const [filtroEventoLog, setFiltroEventoLog] = useState("TODOS");
  const [filtroPerfilLog, setFiltroPerfilLog] = useState("TODOS");

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [resU, resL] = await Promise.all([
        fetch("/api/admin/usuarios", { cache: "no-store" }),
        fetch("/api/admin/logs-acesso", { cache: "no-store" }),
      ]);
      if (resU.ok) {
        const dU = await resU.json();
        if (Array.isArray(dU.usuarios)) setUsuarios(dU.usuarios);
      }
      if (resL.ok) {
        const dL = await resL.json();
        if (Array.isArray(dL.logs)) setLogs(dL.logs);
      }
    } catch (e) {
      console.warn("Erro ao carregar usuários e logs:", e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [modo]);

  const mapaPerfis = useMemo(() => {
    const m: Record<string, any> = {};
    perfis.forEach((p) => {
      m[p.id] = p;
    });
    return m;
  }, [perfis]);

  // ───────────────────────────────────────────────────────────────────────────
  // AÇÕES DE GESTÃO DE USUÁRIOS
  // ───────────────────────────────────────────────────────────────────────────
  const abrirModalNovoUsuario = () => {
    setFormUser({
      id: "",
      login: "",
      nome: "",
      email: "",
      cargo: "Líder de Projeto",
      perfilId: "LIDER",
      liderVinculado: "TODOS",
      senha: "nnos2026",
      mfaAtivo: true,
      mfaSecret: "",
      status: "ATIVO",
      fotoUrl: "",
    });
    setModalUsuarioAberto(true);
  };

  const abrirModalEditarUsuario = (u: any) => {
    setFormUser({
      id: u.id,
      login: u.login,
      nome: u.nome,
      email: u.email,
      cargo: u.cargo,
      perfilId: u.perfilId || "LIDER",
      liderVinculado: u.liderVinculado || "TODOS",
      senha: u.senha || "nnos2026",
      mfaAtivo: Boolean(u.mfaAtivo),
      mfaSecret: u.mfaSecret || "",
      status: u.status || "ATIVO",
      fotoUrl: u.fotoUrl || "",
    });
    setModalUsuarioAberto(true);
  };

  const handleUploadFotoModal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
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
        if (ctx) ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
        setFormUser((prev: any) => ({ ...prev, fotoUrl: dataUrl }));
      };
      img.src = String(ev.target?.result || "");
    };
    reader.readAsDataURL(file);
  };

  const handleSalvarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUser.nome.trim() || !formUser.login.trim()) {
      onToast("Informe ao menos o Nome Completo e o Login do usuário.");
      return;
    }

    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "CRIAR_OU_EDITAR",
          usuario: formUser,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.usuarios)) setUsuarios(data.usuarios);

        // Sincronizar foto no localStorage para refletir no header imediatamente
        if (formUser.fotoUrl) {
          try {
            const fotosAtuais = JSON.parse(localStorage.getItem("nnos_fotos_usuarios_v1") || "{}");
            fotosAtuais[formUser.login.toLowerCase()] = formUser.fotoUrl;
            fotosAtuais[formUser.nome.toUpperCase()] = formUser.fotoUrl;
            localStorage.setItem("nnos_fotos_usuarios_v1", JSON.stringify(fotosAtuais));
            window.dispatchEvent(new CustomEvent("nnos-user-updated"));
          } catch {}
        }

        setModalUsuarioAberto(false);
        onToast(formUser.id ? `Usuário ${formUser.nome} atualizado com sucesso!` : `Usuário ${formUser.nome} criado com sucesso!`);
        carregarDados();
      }
    } catch {
      onToast("Erro ao salvar usuário.");
    }
  };

  const handleAlternarStatusUsuario = async (u: any) => {
    const novoStatus = u.status === "BLOQUEADO" ? "ATIVO" : "BLOQUEADO";
    const res = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acao: "CRIAR_OU_EDITAR",
        usuario: { ...u, status: novoStatus },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.usuarios)) setUsuarios(data.usuarios);
      onToast(
        novoStatus === "BLOQUEADO"
          ? `Acesso de ${u.nome} bloqueado.`
          : `Acesso de ${u.nome} reativado.`
      );
      carregarDados();
    }
  };

  const handleRegerarMfa = async (id: string) => {
    const res = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "GERAR_NOVO_MFA", id }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.usuarios)) setUsuarios(data.usuarios);
      if (data.usuario) setUsuarioQrModal(data.usuario);
      onToast("Nova chave secreta do Google Authenticator gerada!");
      carregarDados();
    }
  };

  const handleExcluirUsuario = async (u: any) => {
    const res = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "EXCLUIR", id: u.id }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.usuarios)) setUsuarios(data.usuarios);
      onToast(`Usuário ${u.nome} removido.`);
      carregarDados();
    }
  };

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      if (filtroPerfilUser !== "TODOS" && u.perfilId !== filtroPerfilUser) return false;
      if (filtroStatusUser !== "TODOS" && u.status !== filtroStatusUser) return false;
      if (buscaUsuario.trim()) {
        const q = buscaUsuario.toLowerCase();
        return (
          String(u.nome || "").toLowerCase().includes(q) ||
          String(u.login || "").toLowerCase().includes(q) ||
          String(u.email || "").toLowerCase().includes(q) ||
          String(u.cargo || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [usuarios, filtroPerfilUser, filtroStatusUser, buscaUsuario]);

  const logsFiltrados = useMemo(() => {
    return logs.filter((l) => {
      if (filtroStatusLog !== "TODOS" && l.status !== filtroStatusLog) return false;
      if (filtroEventoLog !== "TODOS" && l.evento !== filtroEventoLog) return false;
      if (filtroPerfilLog !== "TODOS" && l.perfilId !== filtroPerfilLog) return false;
      if (buscaLog.trim()) {
        const q = buscaLog.toLowerCase();
        return (
          String(l.usuarioNome || "").toLowerCase().includes(q) ||
          String(l.usuarioLogin || "").toLowerCase().includes(q) ||
          String(l.usuarioEmail || "").toLowerCase().includes(q) ||
          String(l.detalhes || "").toLowerCase().includes(q) ||
          String(l.ip || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, filtroStatusLog, filtroEventoLog, filtroPerfilLog, buscaLog]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: ABA GESTÃO DE USUÁRIOS, SENHAS & MFA GOOGLE AUTHENTICATOR
  // ═══════════════════════════════════════════════════════════════════════════
  if (modo === "GESTAO_USUARIOS") {
    const totalAtivos = usuarios.filter((u) => u.status === "ATIVO").length;
    const totalMfa = usuarios.filter((u) => u.mfaAtivo).length;
    const totalBloqueados = usuarios.filter((u) => u.status === "BLOQUEADO").length;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* Cards Resumo de Credenciais */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
          }}
        >
          <div style={{ backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#e0f2fe", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="material-symbols-outlined">group</span>
            </div>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Total de Contas</span>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--primary)" }}>{usuarios.length}</div>
            </div>
          </div>

          <div style={{ backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#dcfce7", color: "#15803d", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="material-symbols-outlined">verified_user</span>
            </div>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Usuários Ativos</span>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#15803d" }}>{totalAtivos}</div>
            </div>
          </div>

          <div style={{ backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#ede9fe", color: "#6d28d9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="material-symbols-outlined">phonelink_lock</span>
            </div>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>MFA Google 2FA Ativo</span>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#6d28d9" }}>{totalMfa}</div>
            </div>
          </div>

          <div style={{ backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#fee2e2", color: "#b91c1c", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="material-symbols-outlined">person_off</span>
            </div>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Contas Bloqueadas</span>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#b91c1c" }}>{totalBloqueados}</div>
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Ação */}
        <div
          style={{
            backgroundColor: "var(--surface-container-lowest)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 14px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface-container-low)",
                minWidth: "260px",
                flex: 1,
                maxWidth: "380px",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--outline)" }}>
                search
              </span>
              <input
                type="text"
                value={buscaUsuario}
                onChange={(e) => setBuscaUsuario(e.target.value)}
                placeholder="Buscar por nome, login, e-mail ou cargo..."
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: "12.5px",
                  width: "100%",
                  color: "var(--on-surface)",
                }}
              />
            </div>

            <ModernDropdown
              value={filtroPerfilUser}
              onChange={(val) => setFiltroPerfilUser(String(val))}
              options={[
                { value: "TODOS", label: "Todos os Perfis" },
                ...perfis.map((p) => ({ value: p.id, label: `${p.nome} (${p.sigla})` })),
              ]}
              icon="badge"
              minWidth={220}
              searchable={false}
            />

            <ModernDropdown
              value={filtroStatusUser}
              onChange={(val) => setFiltroStatusUser(String(val))}
              options={[
                { value: "TODOS", label: "Todos os Status" },
                { value: "ATIVO", label: "Somente Ativos" },
                { value: "BLOQUEADO", label: "Somente Bloqueados" },
              ]}
              icon="verified_user"
              minWidth={180}
              searchable={false}
            />
          </div>

          <button
            type="button"
            onClick={abrirModalNovoUsuario}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 18px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: "var(--primary)",
              color: "#ffffff",
              fontSize: "12.5px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              person_add
            </span>
            <span>Novo Usuário</span>
          </button>
        </div>

        {/* Tabela de Usuários e Credenciais */}
        <div
          style={{
            backgroundColor: "var(--surface-container-lowest)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            overflowX: "auto",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--surface-container-low)",
                  borderBottom: "1px solid var(--border)",
                  color: "var(--on-surface-variant)",
                  fontSize: "11px",
                  textTransform: "uppercase",
                }}
              >
                <th style={{ padding: "13px 16px" }}>Usuário &amp; Identificação</th>
                <th style={{ padding: "13px 14px" }}>Login de Acesso</th>
                <th style={{ padding: "13px 14px" }}>Perfil &amp; Escopo</th>
                <th style={{ padding: "13px 14px" }}>Senha Atual</th>
                <th style={{ padding: "13px 14px" }}>Google Authenticator (MFA)</th>
                <th style={{ padding: "13px 14px" }}>Último Acesso</th>
                <th style={{ padding: "13px 14px", textAlign: "center" }}>Status</th>
                <th style={{ padding: "13px 16px", textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map((u) => {
                const pInfo = mapaPerfis[u.perfilId] || {
                  sigla: u.perfilId,
                  nome: u.perfilId,
                  cor: "#0284c7",
                  bgCor: "#e0f2fe",
                };
                const verSenha = !!senhasVisiveis[u.id];

                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div
                          onClick={() => abrirModalEditarUsuario(u)}
                          title="Clique para editar usuário / alterar foto"
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "50%",
                            backgroundColor: "var(--primary)",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: "12px",
                            overflow: "hidden",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          {u.fotoUrl ? (
                            <img
                              src={u.fotoUrl}
                              alt={u.nome}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <span>{obterIniciais(u.nome)}</span>
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: "13px", color: "var(--primary)" }}>
                            {u.nome}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                            {u.email} • {u.cargo}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: "12px 14px" }}>
                      <code
                        style={{
                          padding: "3px 8px",
                          borderRadius: "6px",
                          backgroundColor: "var(--surface-container)",
                          fontWeight: 700,
                          color: "var(--primary)",
                          fontSize: "12px",
                        }}
                      >
                        {u.login}
                      </code>
                    </td>

                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: "flex-start" }}>
                        <span
                          style={{
                            padding: "2px 9px",
                            borderRadius: "999px",
                            fontSize: "10.5px",
                            fontWeight: 800,
                            backgroundColor: pInfo.bgCor,
                            color: pInfo.cor,
                          }}
                        >
                          {pInfo.nome} ({pInfo.sigla})
                        </span>
                        {u.liderVinculado && u.liderVinculado !== "TODOS" && (
                          <span style={{ fontSize: "10.5px", color: "var(--on-surface-variant)" }}>
                            Carteira: <strong>{u.liderVinculado}</strong>
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: "12.5px",
                            color: "var(--on-surface)",
                          }}
                        >
                          {verSenha ? u.senha : "••••••••"}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSenhasVisiveis((prev) => ({ ...prev, [u.id]: !prev[u.id] }))
                          }
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            color: "var(--on-surface-variant)",
                            padding: "2px",
                            display: "inline-flex",
                          }}
                          title={verSenha ? "Ocultar senha" : "Ver senha"}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                            {verSenha ? "visibility_off" : "visibility"}
                          </span>
                        </button>
                      </div>
                    </td>

                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontSize: "10.5px",
                            fontWeight: 800,
                            backgroundColor: u.mfaAtivo ? "#ede9fe" : "#f1f5f9",
                            color: u.mfaAtivo ? "#6d28d9" : "#64748b",
                          }}
                        >
                          {u.mfaAtivo ? "2FA ATIVO" : "OPCIONAL"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setUsuarioQrModal(u)}
                          style={{
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--surface-container-low)",
                            borderRadius: "6px",
                            padding: "3px 8px",
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "var(--primary)",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                            qr_code_2
                          </span>
                          <span>QR / {u.totpAtual || "123456"}</span>
                        </button>
                      </div>
                    </td>

                    <td style={{ padding: "12px 14px", color: "var(--on-surface-variant)", whiteSpace: "nowrap" }}>
                      {formatarDataHoraBR(u.ultimoAcesso) || "—"}
                    </td>

                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: "999px",
                          fontSize: "10.5px",
                          fontWeight: 800,
                          backgroundColor: u.status === "BLOQUEADO" ? "#fee2e2" : "#dcfce7",
                          color: u.status === "BLOQUEADO" ? "#b91c1c" : "#15803d",
                        }}
                      >
                        {u.status}
                      </span>
                    </td>

                    <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => abrirModalEditarUsuario(u)}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "7px",
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--surface-container-low)",
                            color: "var(--primary)",
                            fontSize: "11.5px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                            edit
                          </span>
                          <span>Editar / Senha</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAlternarStatusUsuario(u)}
                          style={{
                            padding: "5px 9px",
                            borderRadius: "7px",
                            border: "1px solid var(--border)",
                            backgroundColor: u.status === "BLOQUEADO" ? "#dcfce7" : "#fef3c7",
                            color: u.status === "BLOQUEADO" ? "#166534" : "#b45309",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                          title={u.status === "BLOQUEADO" ? "Desbloquear conta" : "Bloquear conta"}
                        >
                          {u.status === "BLOQUEADO" ? "Ativar" : "Bloquear"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExcluirUsuario(u)}
                          style={{
                            padding: "5px 7px",
                            borderRadius: "7px",
                            border: "none",
                            backgroundColor: "transparent",
                            color: "#dc2626",
                            cursor: "pointer",
                          }}
                          title="Excluir usuário"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>
                            delete
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Modal Criar / Editar Usuário, Senha e Foto */}
        {modalUsuarioAberto && (
          <div
            onClick={() => setModalUsuarioAberto(false)}
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(6, 13, 30, 0.6)",
              backdropFilter: "blur(4px)",
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: "560px",
                backgroundColor: "var(--surface-container-lowest, #ffffff)",
                borderRadius: "18px",
                border: "1px solid var(--border)",
                boxShadow: "0 20px 50px rgba(0,0,0,0.28)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  backgroundColor: "var(--primary)",
                  color: "#ffffff",
                  padding: "18px 22px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="material-symbols-outlined">manage_accounts</span>
                  <strong style={{ fontSize: "15px" }}>
                    {formUser.id ? `Editar Credenciais: ${formUser.nome}` : "Cadastrar Novo Usuário Corporativo"}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => setModalUsuarioAberto(false)}
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    border: "none",
                    color: "#ffffff",
                    width: "30px",
                    height: "30px",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSalvarUsuario} style={{ padding: "22px", display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Foto do Usuário */}
                <div style={{ display: "flex", alignItems: "center", gap: "16px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
                  <div
                    onClick={() => fileInputModalRef.current?.click()}
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      backgroundColor: "var(--primary)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      fontWeight: 800,
                      overflow: "hidden",
                      cursor: "pointer",
                      border: "2px dashed #0284c7",
                      flexShrink: 0,
                    }}
                  >
                    {formUser.fotoUrl ? (
                      <img src={formUser.fotoUrl} alt={formUser.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span>{obterIniciais(formUser.nome)}</span>
                    )}
                  </div>
                  <input
                    ref={fileInputModalRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadFotoModal}
                    style={{ display: "none" }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--primary)" }}>Foto de Identificação do Usuário</div>
                    <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                      <button
                        type="button"
                        onClick={() => fileInputModalRef.current?.click()}
                        style={{
                          padding: "5px 12px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          backgroundColor: "var(--surface-container-low)",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          color: "var(--primary)",
                          cursor: "pointer",
                        }}
                      >
                        Carregar Foto
                      </button>
                      {formUser.fotoUrl && (
                        <button
                          type="button"
                          onClick={() => setFormUser((prev: any) => ({ ...prev, fotoUrl: "" }))}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "8px",
                            border: "none",
                            backgroundColor: "#fee2e2",
                            fontSize: "11.5px",
                            fontWeight: 700,
                            color: "#b91c1c",
                            cursor: "pointer",
                          }}
                        >
                          Remover Foto
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Nome Completo *</label>
                    <input
                      type="text"
                      value={formUser.nome}
                      onChange={(e) => setFormUser({ ...formUser, nome: e.target.value })}
                      placeholder="Ex: Fábio Canassa"
                      style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1px solid var(--border)", fontSize: "13px" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Login de Acesso *</label>
                    <input
                      type="text"
                      value={formUser.login}
                      onChange={(e) => setFormUser({ ...formUser, login: e.target.value })}
                      placeholder="Ex: fabio.canassa"
                      style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1px solid var(--border)", fontSize: "13px" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>E-mail Corporativo</label>
                    <input
                      type="email"
                      value={formUser.email}
                      onChange={(e) => setFormUser({ ...formUser, email: e.target.value })}
                      placeholder="usuario@nnos.com.br"
                      style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1px solid var(--border)", fontSize: "13px" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Cargo / Função</label>
                    <input
                      type="text"
                      value={formUser.cargo}
                      onChange={(e) => setFormUser({ ...formUser, cargo: e.target.value })}
                      placeholder="Ex: Líder de Projeto • HRD"
                      style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1px solid var(--border)", fontSize: "13px" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Perfil de Acesso (RBAC)</label>
                    <ModernDropdown
                      value={formUser.perfilId}
                      onChange={(val) => setFormUser({ ...formUser, perfilId: String(val) })}
                      options={perfis.map((p) => ({ value: p.id, label: `${p.nome} (${p.sigla})` }))}
                      icon="shield_person"
                      style={{ width: "100%" }}
                      buttonStyle={{ width: "100%", height: "38px" }}
                      searchable={false}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Carteira de Líder Vinculada</label>
                    <ModernDropdown
                      value={formUser.liderVinculado}
                      onChange={(val) => setFormUser({ ...formUser, liderVinculado: String(val) })}
                      options={OPCOES_LIDER_VINCULADO}
                      icon="supervisor_account"
                      style={{ width: "100%" }}
                      buttonStyle={{ width: "100%", height: "38px" }}
                      searchable={false}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Senha de Acesso *</label>
                    <input
                      type="text"
                      value={formUser.senha}
                      onChange={(e) => setFormUser({ ...formUser, senha: e.target.value })}
                      placeholder="Digite ou redefina a senha"
                      style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1px solid var(--border)", fontSize: "13px", fontFamily: "monospace", fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>Status da Conta</label>
                    <ModernDropdown
                      value={formUser.status}
                      onChange={(val) => setFormUser({ ...formUser, status: String(val) })}
                      options={[
                        { value: "ATIVO", label: "Ativo (Liberado)" },
                        { value: "BLOQUEADO", label: "Bloqueado (Sem Acesso)" },
                      ]}
                      icon="verified_user"
                      style={{ width: "100%" }}
                      buttonStyle={{ width: "100%", height: "38px" }}
                      searchable={false}
                    />
                  </div>
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    backgroundColor: "var(--surface-container-low)",
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!formUser.mfaAtivo}
                    onChange={(e) => setFormUser({ ...formUser, mfaAtivo: e.target.checked })}
                    style={{ width: "16px", height: "16px", accentColor: "var(--primary)" }}
                  />
                  <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--primary)" }}>
                    Habilitar Autenticação em 2 Fatores (MFA — Google Authenticator)
                  </span>
                </label>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setModalUsuarioAberto(false)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: "9px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-container-low)",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: "9px 20px",
                      borderRadius: "9px",
                      border: "none",
                      backgroundColor: "#059669",
                      color: "#ffffff",
                      fontSize: "12.5px",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Salvar Usuário &amp; Senha
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de QR Code MFA Google Authenticator */}
        {usuarioQrModal && (
          <div
            onClick={() => setUsuarioQrModal(null)}
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(6, 13, 30, 0.6)",
              backdropFilter: "blur(4px)",
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: "410px",
                backgroundColor: "var(--surface-container-lowest, #ffffff)",
                borderRadius: "18px",
                border: "1px solid var(--border)",
                padding: "24px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--primary)" }}>
                Google Authenticator • {usuarioQrModal.nome}
              </div>
              <div style={{ fontSize: "12px", color: "var(--on-surface-variant)" }}>
                Escaneie este QR Code no aplicativo Google Authenticator do usuário:
              </div>
              <div style={{ padding: "12px", backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid var(--border)" }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                    `otpauth://totp/NNOS:${encodeURIComponent(usuarioQrModal.email)}?secret=${
                      usuarioQrModal.mfaSecret || "JBSWY3DPEHPK3PXP"
                    }&issuer=NNOS%20Consultoria`
                  )}`}
                  alt="QR Code MFA"
                  style={{ width: "150px", height: "150px", display: "block" }}
                />
              </div>
              <div style={{ fontSize: "11.5px", color: "var(--on-surface-variant)" }}>
                Chave Secreta Base32: <strong style={{ fontFamily: "monospace", color: "var(--primary)" }}>{usuarioQrModal.mfaSecret}</strong>
              </div>
              <div style={{ padding: "8px 16px", borderRadius: "10px", backgroundColor: "#e0f2fe", color: "#0369a1", fontSize: "13px", fontWeight: 800 }}>
                Código TOTP Atual (30s): <span style={{ letterSpacing: "0.15em" }}>{usuarioQrModal.totpAtual || "123456"}</span>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => handleRegerarMfa(usuarioQrModal.id)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--surface-container-low)",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Gerar Nova Chave
                </button>
                <button
                  type="button"
                  onClick={() => setUsuarioQrModal(null)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "var(--primary)",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: ABA MONITORAMENTO DE LOG DE ACESSO & AUDITORIA
  // ═══════════════════════════════════════════════════════════════════════════
  const totalSucesso = logs.filter((l) => l.status === "SUCESSO").length;
  const totalMfaLogs = logs.filter((l) => l.evento === "LOGIN_MFA_GOOGLE").length;
  const totalAlertas = logs.filter((l) => l.status === "ALERTA").length;
  const totalErros = logs.filter((l) => l.status === "ERRO").length;

  const badgeStatusLog = (st: string) => {
    if (st === "SUCESSO") return { bg: "#dcfce7", color: "#15803d", label: "SUCESSO" };
    if (st === "ALERTA") return { bg: "#fef3c7", color: "#b45309", label: "ALERTA" };
    return { bg: "#fee2e2", color: "#b91c1c", label: "FALHA / BLOQUEIO" };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* Cards KPI de Monitoramento de Segurança */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
        }}
      >
        <div style={{ backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#dcfce7", color: "#15803d", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined">login</span>
          </div>
          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Acessos Autorizados</span>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#15803d" }}>{totalSucesso}</div>
          </div>
        </div>

        <div style={{ backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#ede9fe", color: "#6d28d9", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined">phonelink_lock</span>
          </div>
          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Logins c/ Google MFA</span>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#6d28d9" }}>{totalMfaLogs}</div>
          </div>
        </div>

        <div style={{ backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#fef3c7", color: "#b45309", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined">lock_reset</span>
          </div>
          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Recuperações / Alertas</span>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#b45309" }}>{totalAlertas}</div>
          </div>
        </div>

        <div style={{ backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#fee2e2", color: "#b91c1c", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined">gpp_bad</span>
          </div>
          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Tentativas Negadas</span>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#b91c1c" }}>{totalErros}</div>
          </div>
        </div>
      </div>

      {/* Filtros de Auditoria */}
      <div
        style={{
          backgroundColor: "var(--surface-container-lowest)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface-container-low)",
              minWidth: "240px",
              flex: 1,
              maxWidth: "340px",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--outline)" }}>
              search
            </span>
            <input
              type="text"
              value={buscaLog}
              onChange={(e) => setBuscaLog(e.target.value)}
              placeholder="Buscar por usuário, IP ou detalhe..."
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: "12.5px",
                width: "100%",
                color: "var(--on-surface)",
              }}
            />
          </div>

          <ModernDropdown
            value={filtroStatusLog}
            onChange={(val) => setFiltroStatusLog(String(val))}
            options={[
              { value: "TODOS", label: "Todos os Status" },
              { value: "SUCESSO", label: "Sucesso" },
              { value: "ALERTA", label: "Alerta / Recuperação" },
              { value: "ERRO", label: "Falha / Tentativa Negada" },
            ]}
            icon="policy"
            minWidth={195}
            searchable={false}
          />

          <ModernDropdown
            value={filtroEventoLog}
            onChange={(val) => setFiltroEventoLog(String(val))}
            options={[
              { value: "TODOS", label: "Todos os Eventos" },
              { value: "LOGIN_MFA_GOOGLE", label: "Login c/ Google Authenticator" },
              { value: "LOGIN_SUCESSO", label: "Login Padrão" },
              { value: "RECUPERACAO_SENHA", label: "Esqueci Minha Senha" },
              { value: "ALTERACAO_SENHA", label: "Alteração de Senha" },
              { value: "FALHA_AUTENTICACAO", label: "Falha de Senha" },
              { value: "LOGOUT_SESSAO", label: "Logout de Sessão" },
            ]}
            icon="event_note"
            minWidth={225}
            searchable={false}
          />

          <ModernDropdown
            value={filtroPerfilLog}
            onChange={(val) => setFiltroPerfilLog(String(val))}
            options={[
              { value: "TODOS", label: "Todos os Perfis" },
              ...perfis.map((p) => ({ value: p.id, label: `${p.nome} (${p.sigla})` })),
            ]}
            icon="shield_person"
            minWidth={195}
            searchable={false}
          />
        </div>

        <button
          type="button"
          onClick={carregarDados}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderRadius: "9px",
            border: "1px solid var(--border)",
            backgroundColor: "var(--surface-container-low)",
            color: "var(--primary)",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
            refresh
          </span>
          <span>{carregando ? "Atualizando..." : "Atualizar Log"}</span>
        </button>
      </div>

      {/* Tabela de Monitoramento de Log de Acesso */}
      <div
        style={{
          backgroundColor: "var(--surface-container-lowest)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
          <thead>
            <tr
              style={{
                backgroundColor: "var(--surface-container-low)",
                borderBottom: "1px solid var(--border)",
                color: "var(--on-surface-variant)",
                fontSize: "11px",
                textTransform: "uppercase",
              }}
            >
              <th style={{ padding: "13px 16px" }}>Data &amp; Hora (BR)</th>
              <th style={{ padding: "13px 14px" }}>Usuário</th>
              <th style={{ padding: "13px 14px" }}>Perfil</th>
              <th style={{ padding: "13px 14px" }}>Evento / Método</th>
              <th style={{ padding: "13px 14px" }}>IP &amp; Dispositivo</th>
              <th style={{ padding: "13px 14px", textAlign: "center" }}>Status</th>
              <th style={{ padding: "13px 16px" }}>Detalhes da Auditoria</th>
            </tr>
          </thead>
          <tbody>
            {logsFiltrados.map((l) => {
              const st = badgeStatusLog(l.status);
              return (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--primary)", whiteSpace: "nowrap" }}>
                    {formatarDataHoraBR(l.dataHora)}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 800, color: "var(--primary)" }}>{l.usuarioNome}</div>
                    <div style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                      {l.usuarioLogin} • {l.usuarioEmail}
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "10.5px",
                        fontWeight: 800,
                        backgroundColor: "var(--surface-container)",
                        color: "var(--primary)",
                      }}
                    >
                      {l.perfilId}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 800, fontSize: "12px", color: "var(--on-surface)" }}>
                      {l.evento}
                    </div>
                    <div style={{ fontSize: "11px", color: "#0284c7", fontWeight: 600 }}>
                      {l.metodo}
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                    <div style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--on-surface)" }}>
                      {l.ip}
                    </div>
                    <div style={{ fontSize: "10.5px", color: "var(--on-surface-variant)" }}>
                      {l.dispositivo}
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: "999px",
                        fontSize: "10.5px",
                        fontWeight: 800,
                        backgroundColor: st.bg,
                        color: st.color,
                      }}
                    >
                      {st.label}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--on-surface-variant)", fontSize: "11.5px" }}>
                    {l.detalhes}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

