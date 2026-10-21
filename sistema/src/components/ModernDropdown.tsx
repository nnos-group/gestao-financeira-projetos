"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";

export type DropdownOption = {
  value: string | number;
  label: string;
};

export interface ModernDropdownProps {
  value: string | number;
  onChange: (val: string | number) => void;
  options: DropdownOption[];
  icon?: string;
  label?: string;
  placeholder?: string;
  minWidth?: number | string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
  dropdownStyle?: React.CSSProperties;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export default function ModernDropdown({
  value,
  onChange,
  options,
  icon,
  label,
  placeholder,
  minWidth,
  disabled = false,
  className,
  style,
  buttonStyle,
  dropdownStyle,
  searchable,
  searchPlaceholder,
}: ModernDropdownProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Ativa busca se explicitamente solicitada ou se a lista contiver 7 ou mais opções
  const isSearchable = searchable !== undefined ? searchable : options.length >= 7;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Foca automaticamente no campo de busca ao abrir
  useEffect(() => {
    if (open) {
      setSearchTerm("");
      if (isSearchable) {
        const timer = setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [open, isSearchable]);

  const selected = options.find((o) => String(o.value) === String(value));
  const displayLabel = selected ? selected.label : placeholder || (options[0]?.label ?? "");

  // Normalização para busca insensível a acentos e maiúsculas/minúsculas
  const normalize = (text: string) =>
    (text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = normalize(searchTerm);
    return options.filter((opt) => {
      const matchLabel = normalize(opt.label).includes(term);
      const matchValue = normalize(String(opt.value)).includes(term);
      return matchLabel || matchValue;
    });
  }, [options, searchTerm]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        flexDirection: "column",
        gap: "4px",
        ...style,
      }}
    >
      {label && (
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--on-surface-variant, #475569)",
            letterSpacing: "0.02em",
            userSelect: "none",
          }}
        >
          {label}
        </span>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "7px 12px",
          borderRadius: "10px",
          border: open ? "1.5px solid var(--primary, #0284c7)" : "1px solid var(--border, #cbd5e1)",
          background: "var(--surface-container-lowest, #ffffff)",
          boxShadow: open ? "0 0 0 3px rgba(2, 132, 199, 0.15)" : "0 1px 3px rgba(0,0,0,0.04)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          minWidth: minWidth || "auto",
          width: style?.width === "100%" ? "100%" : "auto",
          justifyContent: "space-between",
          outline: "none",
          transition: "all 0.15s ease",
          fontFamily: "var(--font-jakarta), var(--font-inter), sans-serif",
          ...buttonStyle,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
          {icon && (
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "16px", color: "var(--primary, #0284c7)", flexShrink: 0 }}
            >
              {icon}
            </span>
          )}
          <span
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: selected ? "var(--on-surface, #0f172a)" : "var(--on-surface-variant, #64748b)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {displayLabel}
          </span>
        </div>
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: "18px",
            color: "var(--on-surface-variant, #64748b)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
            marginLeft: "4px",
          }}
        >
          expand_more
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: label ? "calc(100% + 2px)" : "calc(100% + 6px)",
            left: 0,
            minWidth: "100%",
            width: "max-content",
            maxWidth: "min(480px, 92vw)",
            background: "var(--surface-container-lowest, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "12px",
            boxShadow: "0 12px 30px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.05)",
            padding: "6px",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            ...dropdownStyle,
          }}
        >
          {/* Campo de Busca Rápida ao Digitar */}
          {isSearchable && (
            <div
              style={{
                padding: "4px 4px 6px 4px",
                borderBottom: "1px solid var(--border, #e2e8f0)",
                marginBottom: "4px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: "var(--surface-container-low, #f8fafc)",
                  border: "1px solid var(--border, #cbd5e1)",
                  borderRadius: "8px",
                  padding: "6px 10px",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "16px", color: "var(--outline, #64748b)", flexShrink: 0 }}
                >
                  search
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder || "Digitar para buscar..."}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && filteredOptions.length > 0) {
                      e.preventDefault();
                      onChange(filteredOptions[0].value);
                      setOpen(false);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setOpen(false);
                    }
                  }}
                  style={{
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontSize: "12.5px",
                    width: "100%",
                    color: "var(--on-surface, #0f172a)",
                    fontFamily: "var(--font-jakarta), var(--font-inter), sans-serif",
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      searchInputRef.current?.focus();
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      color: "var(--outline, #64748b)",
                    }}
                    title="Limpar pesquisa"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                      close
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Lista de Opções Rolável */}
          <div
            style={{
              maxHeight: "280px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: "16px 12px",
                  textAlign: "center",
                  fontSize: "12px",
                  color: "var(--on-surface-variant, #64748b)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "20px", opacity: 0.6 }}>
                  search_off
                </span>
                <span>Nenhum resultado encontrado</span>
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "none",
                      background: isSelected ? "rgba(2, 132, 199, 0.1)" : "transparent",
                      color: isSelected ? "#0284c7" : "var(--on-surface, #0f172a)",
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: "12.5px",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.12s ease",
                      fontFamily: "var(--font-jakarta), var(--font-inter), sans-serif",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "var(--surface-container-low, #f1f5f9)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {opt.label}
                    </span>
                    {isSelected && (
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "16px", color: "#0284c7", flexShrink: 0 }}
                      >
                        check
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
