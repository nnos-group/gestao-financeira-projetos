"use client";

import React from "react";
import { AnexoDocumento } from "@/lib/viagens-types";

interface DocumentPreviewModalProps {
  documento: AnexoDocumento | null;
  onClose: () => void;
}

export default function DocumentPreviewModal({
  documento,
  onClose,
}: DocumentPreviewModalProps) {
  if (!documento) return null;

  const isPdf = documento.mimeType?.includes("pdf") || documento.nome?.toLowerCase().endsWith(".pdf") || documento.url?.startsWith("data:application/pdf");
  const isImage = documento.mimeType?.includes("image") || /\.(jpg|jpeg|png|webp|gif)$/i.test(documento.nome) || documento.url?.startsWith("data:image/");

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "90%",
          maxWidth: "960px",
          height: "85vh",
          backgroundColor: "var(--surface, #ffffff)",
          borderRadius: "14px",
          border: "1px solid var(--border, #e2e8f0)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de Título do Visualizador */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--border, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface-container-low, #f8fafc)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "20px", color: isPdf ? "#ef4444" : "var(--primary, #0f2a4a)" }}
            >
              {isPdf ? "picture_as_pdf" : "image"}
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--on-surface, #0f172a)" }}>
                {documento.nome}
              </h3>
              <span style={{ fontSize: "11px", color: "var(--on-surface-variant, #64748b)" }}>
                Tipo: {documento.tipo} • {documento.tamanhoFormatado || "Tamanho padrão"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Botão de Download */}
            <a
              href={documento.url}
              download={documento.nome}
              className="btn-download-doc"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--on-surface, #0f172a)",
                backgroundColor: "var(--surface, #ffffff)",
                border: "1px solid var(--border, #cbd5e1)",
                textDecoration: "none",
                cursor: "pointer",
              }}
              title="Baixar arquivo para o computador"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>download</span>
              <span>Download</span>
            </a>

            {/* Abrir em nova aba */}
            <a
              href={documento.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--on-surface, #0f172a)",
                backgroundColor: "var(--surface, #ffffff)",
                border: "1px solid var(--border, #cbd5e1)",
                textDecoration: "none",
                cursor: "pointer",
              }}
              title="Abrir em tela cheia / nova aba"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>open_in_new</span>
            </a>

            {/* Fechar */}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                padding: "6px",
                cursor: "pointer",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--on-surface-variant, #64748b)",
              }}
              title="Fechar visualizador"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>close</span>
            </button>
          </div>
        </div>

        {/* Área de Visualização do Conteúdo */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "auto",
            padding: "16px",
          }}
        >
          {isPdf ? (
            <iframe
              src={documento.url}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                borderRadius: "8px",
                backgroundColor: "#ffffff",
                boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
              }}
              title={documento.nome}
            />
          ) : isImage ? (
            <img
              src={documento.url}
              alt={documento.nome}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            />
          ) : (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "var(--outline)" }}>
                description
              </span>
              <p style={{ margin: "12px 0 6px 0", fontWeight: 600, color: "var(--on-surface)" }}>
                Visualização direta não suportada para este formato
              </p>
              <span style={{ fontSize: "12px", color: "var(--on-surface-variant)" }}>
                Utilize o botão &quot;Download&quot; acima para abrir o arquivo localmente.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
