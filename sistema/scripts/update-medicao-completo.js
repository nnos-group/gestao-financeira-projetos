const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/app/medicao/page.tsx');
let content = fs.readFileSync(targetFile, 'utf-8');

// 1. Interface AtividadeMedicao: adicionar dataInicial e dataFinal
content = content.replace(
  `interface AtividadeMedicao {
  projeto: string;
  atividade: string;
  periodo: string;
  horas: number;
  valorHora: number;
  valorTotal: number;
  rateioInterno: string;
}`,
  `interface AtividadeMedicao {
  projeto: string;
  atividade: string;
  periodo: string;
  dataInicial?: string | null;
  dataFinal?: string | null;
  horas: number;
  valorHora: number;
  valorTotal: number;
  rateioInterno: string;
}`
);

// 2. Mudar "Gerar Novo BM a partir da Gestão de Projetos" para "Gerar Novo BM"
content = content.replace(
  'Gerar Novo BM a partir da Gestão de Projetos',
  'Gerar Novo BM'
);

// 3. Mudar "Consultor / Prestador * (Versão Curta)" para "Consultor / Prestador *"
content = content.replace(
  'Consultor / Prestador * (Versão Curta)',
  'Consultor / Prestador *'
);

// 4. Retirar "● Base de Projetos Conectada"
content = content.replace(
  `<span style={{ padding: "2px 8px", borderRadius: "999px", backgroundColor: "#d1fae5", color: "#065f46", fontWeight: 700, fontSize: "11px" }}>
                                ● Base de Projetos Conectada
                              </span>`,
  ''
);

// 5. Retirar "verified Aprovado & Pronto p/ Faturamento" do topo de bmVisualizando
content = content.replace(
  `<span style={{ padding: "2px 8px", borderRadius: "999px", backgroundColor: "#d1fae5", color: "#065f46", fontSize: "11px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>verified</span>
                        Aprovado & Pronto p/ Faturamento
                      </span>`,
  ''
);

// 6. Retirar botão "Copiar Link Seguro"
const oldBtnLinkSeguro = `<button
                      type="button"
                      onClick={() => {
                        if (navigator?.clipboard) {
                          navigator.clipboard.writeText(window.location.href);
                          showToast("Link seguro do Boletim copiado!");
                        }
                      }}
                      className="btn-secondary"
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "8px 14px" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--secondary)" }}>content_copy</span>
                      <span>Copiar Link Seguro</span>
                    </button>`;

if (content.includes(oldBtnLinkSeguro)) {
  content = content.replace(oldBtnLinkSeguro, '');
}

// 7. Mudar "100% auditado e aprovado" para "Aprovado"
content = content.replace(
  '<span>100% auditado e aprovado</span>',
  '<span>Aprovado</span>'
);

// 8. Retirar "Parceiro Credenciado"
content = content.replace(
  `<span style={{ padding: "3px 8px", borderRadius: "999px", backgroundColor: "rgba(0,103,129,0.1)", color: "var(--secondary)", fontSize: "11px", fontWeight: 700 }}>
                          Parceiro Credenciado
                        </span>`,
  ''
);

// 9. Mudar "Savassi / Boa Viagem" para "Boa Viagem" em todas as ocorrências
content = content.replace(/Savassi \/ Boa Viagem/g, 'Boa Viagem');

// 10. Print 2: Ajustar a data de corte para filtrar de verdade as atividades e calcular o período dinâmico
const regexOldPreviewAtiv = /\/\/ Atividades apuradas da Gestão de Projetos\r?\n\s+const previewAtividades = useMemo\(\(\) => \{[\s\S]*?\r?\n\s+\}, \[atividadesProjetos, periodoTipo, mesReferenciaNum, anoReferencia\]\);/;

const newPreviewAtiv = `// Atividades apuradas da Gestão de Projetos respeitando estritamente a data de corte
  const previewAtividades = useMemo(() => {
    if (!atividadesProjetos || atividadesProjetos.length === 0) return [];

    const mm = String(mesReferenciaNum).padStart(2, "0");
    const ultimoDiaMes = new Date(Number(anoReferencia), mesReferenciaNum, 0).getDate();

    // Extrai o dia exato da data de corte informada (ex: "19/09/2026" -> 19)
    let diaCorte = 15;
    if (dataCorte && dataCorte.includes("/")) {
      const parsed = parseInt(dataCorte.split("/")[0], 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= ultimoDiaMes) {
        diaCorte = parsed;
      }
    }

    if (periodoTipo === "1ª Quinzena") {
      const periodoTexto = \`01/\${mm} a \${String(diaCorte).padStart(2, "0")}/\${mm}/\${anoReferencia}\`;

      // Filtra atividades que ocorreram estritamente até a data de corte
      return atividadesProjetos
        .filter((a: any) => {
          if (a.dataInicial && a.dataFinal) {
            const diaInicio = parseInt(a.dataInicial.split("-")[2], 10);
            const diaFim = parseInt(a.dataFinal.split("-")[2], 10);
            // Se a atividade ocorreu inteiramente após a data de corte, exclui da 1ª quinzena
            if (diaInicio > diaCorte && diaFim > diaCorte) return false;
          }
          return true;
        })
        .map((a: any) => ({
          ...a,
          periodo: periodoTexto,
        }));
    } else if (periodoTipo === "2ª Quinzena") {
      const diaInicioSegunda = Math.min(diaCorte + 1, ultimoDiaMes);
      const periodoTexto = \`\${String(diaInicioSegunda).padStart(2, "0")}/\${mm} a \${ultimoDiaMes}/\${mm}/\${anoReferencia}\`;

      // Filtra atividades que ocorreram estritamente a partir do dia seguinte ao corte
      return atividadesProjetos
        .filter((a: any) => {
          if (a.dataInicial && a.dataFinal) {
            const diaInicio = parseInt(a.dataInicial.split("-")[2], 10);
            const diaFim = parseInt(a.dataFinal.split("-")[2], 10);
            // Se a atividade terminou inteiramente antes ou no dia do corte, exclui da 2ª quinzena
            if (diaInicio <= diaCorte && diaFim <= diaCorte) return false;
          }
          return true;
        })
        .map((a: any) => ({
          ...a,
          periodo: periodoTexto,
        }));
    }

    // Integral (Mês Cheio)
    const periodoTexto = \`01/\${mm} a \${ultimoDiaMes}/\${mm}/\${anoReferencia}\`;
    return atividadesProjetos.map((a: any) => ({
      ...a,
      periodo: periodoTexto,
    }));
  }, [atividadesProjetos, periodoTipo, dataCorte, mesReferenciaNum, anoReferencia]);`;

content = content.replace(regexOldPreviewAtiv, newPreviewAtiv);

// Ajustar o cálculo inicial de dataCorte quando mudar período/mês
content = content.replace(
  `  useEffect(() => {
    const mm = String(mesReferenciaNum).padStart(2, "0");
    if (periodoTipo === "1ª Quinzena") {
      setDataCorte(\`15/\${mm}/\${anoReferencia}\`);
    } else {
      setDataCorte(\`30/\${mm}/\${anoReferencia}\`);
    }
  }, [periodoTipo, mesReferenciaNum, anoReferencia]);`,
  `  useEffect(() => {
    const mm = String(mesReferenciaNum).padStart(2, "0");
    const ultDia = new Date(Number(anoReferencia), mesReferenciaNum, 0).getDate();
    if (periodoTipo === "1ª Quinzena" || periodoTipo === "2ª Quinzena") {
      // Corte padrão no dia 15
      setDataCorte(\`15/\${mm}/\${anoReferencia}\`);
    } else {
      setDataCorte(\`\${ultDia}/\${mm}/\${anoReferencia}\`);
    }
  }, [periodoTipo, mesReferenciaNum, anoReferencia]);`
);

// 11. Atualizar o Toast no medicao/page.tsx para o mesmo padrão moderno do SVG
const oldToastMedicao = `{/* Toast Notificação */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            backgroundColor: "var(--primary)",
            color: "#ffffff",
            padding: "12px 18px",
            borderRadius: "10px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            zIndex: 9999,
            animation: "fadeIn 0.2s ease",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#87ddff" }}>check_circle</span>
          <span>{toastMsg}</span>
        </div>
      )}`;

const newToastMedicao = `{/* Notificação Toast Moderna (Design Padronizado Print 1) */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "24px",
            zIndex: 9999,
            width: "320px",
            height: "48px",
            backgroundColor: "#ffffff",
            borderRadius: "14px",
            border: "1px solid #e6edf5",
            boxShadow: "0 8px 24px rgba(15,42,74,0.10), 0 2px 6px rgba(15,42,74,0.04)",
            display: "flex",
            alignItems: "center",
            padding: "0 12px 0 0",
            overflow: "hidden",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            style={{
              width: "4px",
              height: "28px",
              borderRadius: "2px",
              background: "linear-gradient(180deg, #34d399, #059669)",
              marginLeft: "8px",
              marginRight: "10px",
            }}
          />
          <div
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "50%",
              backgroundColor: "#ecfdf5",
              border: "1px solid #a7f3d0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: "10px",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #10b981, #059669)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1.5 4L3.8 6.2L8.5 1.5" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
              fontSize: "13.5px",
              fontWeight: 700,
              color: "#0f2a4a",
              letterSpacing: "-0.2px",
              flex: 1,
            }}
          >
            {toastMsg}
          </span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              backgroundColor: "#f1f5f9",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              color: "#64748b",
            }}
            title="Fechar"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="#64748b" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}`;

content = content.replace(oldToastMedicao, newToastMedicao);

// 12. Adicionar Cabeçalho Oficial de Impressão e Estilos @media print A4
const printHeaderHtml = `{/* Cabeçalho Oficial Exclusivo para Exportação / Impressão A4 (1 página com margem 1,5 cm) */}
                <div className="print-header-only" style={{ display: "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #002b49", paddingBottom: "10px", marginBottom: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <img src="/logo-coruja.png" alt="Logo NNÓS" style={{ width: "44px", height: "44px", objectFit: "contain" }} />
                      <div>
                        <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#002b49", margin: 0, textTransform: "uppercase", letterSpacing: "-0.01em" }}>
                          Boletim de Medição de Serviços
                        </h1>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#006781" }}>
                          NNÓS Consultoria e Treinamento LTDA • CNPJ: 36.443.716/0001-00
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "18px", fontWeight: 800, color: "#002b49" }}>
                        BM {bmVisualizando.codigo}
                      </div>
                      <div style={{ fontSize: "11px", color: "#4a5568", fontWeight: 600 }}>
                        Contrato {bmVisualizando.contrato} • {bmVisualizando.mesReferencia}
                      </div>
                    </div>
                  </div>
                </div>`;

content = content.replace(
  '{/* Top Command & Action Bar */}',
  printHeaderHtml + '\n\n                {/* Top Command & Action Bar */}'
);

// Adicionar estilos de impressão no final do arquivo
const printStyles = `
      {/* Estilos de Impressão A4 Otimizados (1 Página, 1.5cm de Margem, Sem Elementos de Sistema) */}
      <style jsx global>{\`
        @page {
          size: A4 portrait;
          margin: 15mm;
        }

        @media print {
          /* Ocultar elementos de sistema e botões de tela */
          aside.sidebar,
          header.top-header,
          .no-print,
          button,
          .btn-primary,
          .btn-secondary,
          .theme-toggle-btn {
            display: none !important;
          }

          /* Ocultar barra superior de navegação da tela */
          .screen-nav-bar {
            display: none !important;
          }

          /* Ativar cabeçalho oficial de impressão */
          .print-header-only {
            display: block !important;
          }

          /* Reset para página A4 limpa */
          html, body, .app-layout, .main-wrapper, .main-content {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            font-size: 10px !important;
            line-height: 1.25 !important;
          }

          /* Evitar quebras de página */
          * {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Reduzir espaçamentos e fontes para caber rigorosamente em 1 página */
          h1, h2, h3, h4 {
            color: #002b49 !important;
          }

          table {
            font-size: 9.5px !important;
          }

          th, td {
            padding: 4px 6px !important;
          }
        }
      \`}</style>
`;

content = content.replace('    </div>\n  );\n}', printStyles + '    </div>\n  );\n}');

fs.writeFileSync(targetFile, content, 'utf-8');
console.log('Atualizações de medicao/page.tsx concluídas com sucesso!');
