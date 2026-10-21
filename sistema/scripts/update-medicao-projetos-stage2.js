const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/app/medicao/page.tsx');
let content = fs.readFileSync(targetFile, 'utf-8');

// 1. Substituir os estados do formulário de geração
const regexOldStates = /\/\/ Painel de Geração de Novo BM\r?\n\s+const \[painelGeracaoAberto, setPainelGeracaoAberto\] = useState\(false\);[\s\S]*?\/\/ Modal de Assinatura & Signatários/;

const newStates = `// Painel de Geração de Novo BM
  const [painelGeracaoAberto, setPainelGeracaoAberto] = useState(false);
  const [consultorSelecionadoNome, setConsultorSelecionadoNome] = useState(
    CONSULTORES_DISPONIVEIS[0]?.nome || "TIAGO ANGELO"
  );
  const [anoReferencia, setAnoReferencia] = useState("2026");
  const [mesReferenciaNum, setMesReferenciaNum] = useState(9);
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([2026, 2027]);
  const [mesesComLancamentos, setMesesComLancamentos] = useState<number[]>([]);
  const [carregandoProjetos, setCarregandoProjetos] = useState(false);
  const [atividadesProjetos, setAtividadesProjetos] = useState<AtividadeMedicao[]>([]);
  const [periodoTipo, setPeriodoTipo] = useState<"1ª Quinzena" | "2ª Quinzena" | "Integral">("Integral");
  const [dataCorte, setDataCorte] = useState("15/09/2026");

  const mesNomeAtual = useMemo(() => {
    return MESES_LISTA.find((m) => m.num === mesReferenciaNum)?.nome || "Setembro";
  }, [mesReferenciaNum]);

  const mesReferenciaFormatado = \`\${mesNomeAtual} / \${anoReferencia}\`;

  // Atualização automática da data de corte conforme período e mês
  useEffect(() => {
    const mm = String(mesReferenciaNum).padStart(2, "0");
    if (periodoTipo === "1ª Quinzena") {
      setDataCorte(\`15/\${mm}/\${anoReferencia}\`);
    } else {
      setDataCorte(\`30/\${mm}/\${anoReferencia}\`);
    }
  }, [periodoTipo, mesReferenciaNum, anoReferencia]);

  // Busca em tempo real na base de dados dos Projetos
  useEffect(() => {
    if (!consultorSelecionadoNome) return;
    setCarregandoProjetos(true);
    fetch(\`/api/medicao/projetos?consultor_nome=\${encodeURIComponent(consultorSelecionadoNome)}&ano=\${anoReferencia}&mes=\${mesReferenciaNum}\`)
      .then((res) => res.json())
      .then((data) => {
        if (data.mesesComLancamentos) {
          setMesesComLancamentos(data.mesesComLancamentos);
        }
        if (data.anosDisponiveis && data.anosDisponiveis.length > 0) {
          setAnosDisponiveis(data.anosDisponiveis);
        }
        if (data.lancamentos && Array.isArray(data.lancamentos)) {
          setAtividadesProjetos(data.lancamentos);
        } else {
          setAtividadesProjetos([]);
        }
      })
      .catch((err) => {
        console.warn("Erro ao buscar lançamentos de Projetos", err);
        setAtividadesProjetos([]);
      })
      .finally(() => {
        setCarregandoProjetos(false);
      });
  }, [consultorSelecionadoNome, anoReferencia, mesReferenciaNum]);

  // Modal de Assinatura & Signatários`;

content = content.replace(regexOldStates, newStates);

// 2. Substituir previewAtividades e handleIniciarGeracaoBM
const regexOldPreview = /\/\/ Simulação de cálculo das atividades vindas da Gestão de Projetos\r?\n\s+const previewAtividades = useMemo\(\(\) => \{[\s\S]*?const handleIniciarGeracaoBM = \(\) => \{[\s\S]*?setModalAssinaturaAberto\(true\);\r?\n\s+\};/;

const newPreview = `// Atividades apuradas da Gestão de Projetos
  const previewAtividades = useMemo(() => {
    if (atividadesProjetos.length > 0) {
      const mm = String(mesReferenciaNum).padStart(2, "0");
      if (periodoTipo === "1ª Quinzena") {
        return atividadesProjetos.map((a) => ({
          ...a,
          periodo: \`01/\${mm} a 15/\${mm}/\${anoReferencia}\`,
        }));
      } else if (periodoTipo === "2ª Quinzena") {
        return atividadesProjetos.map((a) => ({
          ...a,
          periodo: \`16/\${mm} a 30/\${mm}/\${anoReferencia}\`,
        }));
      }
      return atividadesProjetos;
    }
    return [];
  }, [atividadesProjetos, periodoTipo, mesReferenciaNum, anoReferencia]);

  const previewTotalHoras = useMemo(() => {
    return previewAtividades.reduce((acc, a) => acc + (a.horas || 0), 0);
  }, [previewAtividades]);

  const previewValorTotal = useMemo(() => {
    return previewAtividades.reduce((acc, a) => acc + (a.valorTotal || 0), 0);
  }, [previewAtividades]);

  // Iniciar geração do BM a partir dos lançamentos da base de Projetos
  const handleIniciarGeracaoBM = () => {
    const atividadesFinais = previewAtividades.length > 0 ? previewAtividades : [
      {
        projeto: "PROJETO NNÓS",
        atividade: \`Atividades Técnicas Especializadas - \${periodoTipo}\`,
        periodo: \`Referência \${mesReferenciaFormatado}\`,
        horas: 0,
        valorHora: 0,
        valorTotal: 0,
        rateioInterno: "0,00%",
      }
    ];

    const novoBM: Partial<BoletimMedicaoItem> = {
      codigo: proximoCodigo,
      consultorNome: consultorObj.nomeCompleto || consultorObj.nome,
      consultorRazaoSocial: consultorObj.razaoSocial,
      consultorCnpj: consultorObj.cnpj,
      consultorEmail: consultorObj.email,
      consultorEndereco: consultorObj.endereco,
      contrato: consultorObj.contrato,
      mesReferencia: mesReferenciaFormatado,
      periodoTipo,
      dataCorte,
      totalHoras: previewTotalHoras,
      valorTotal: previewValorTotal,
      mediaHora: previewTotalHoras > 0 ? previewValorTotal / previewTotalHoras : 0,
      atividades: atividadesFinais,
    };

    setBmEmCriacao(novoBM);
    setEmailConsultor(consultorObj.email);
    setModalAssinaturaAberto(true);
  };`;

content = content.replace(regexOldPreview, newPreview);

// 3. Substituir o HTML do formulário de geração (separando Ano e Mês, versão curta, exibindo atividades vinculadas)
const regexOldFormHtml = /\{\/\* PAINEL \/ FORMULÁRIO DE GERAÇÃO DO BM \(PASSO ANTERIOR\) \*\/\}[\s\S]*?\{\/\* BARRA DE PESQUISA E FILTROS DE STATUS DO WORKFLOW \*\/\}/;

const newFormHtml = `{/* PAINEL / FORMULÁRIO DE GERAÇÃO DO BM (PASSO ANTERIOR) */}
                {painelGeracaoAberto && (
                  <div style={{ backgroundColor: "var(--surface-container-lowest)", padding: "22px 24px", borderRadius: "14px", border: "2px solid var(--secondary)", boxShadow: "0 8px 24px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: "18px", width: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="material-symbols-outlined" style={{ color: "var(--secondary)", fontSize: "22px" }}>tune</span>
                        <strong style={{ fontSize: "16px", color: "var(--primary)" }}>
                          Gerar Novo BM a partir da Gestão de Projetos
                        </strong>
                      </div>
                      <span style={{ fontSize: "12px", color: "var(--on-surface-variant)" }}>
                        Próximo Código Sequencial: <strong style={{ color: "var(--secondary)" }}>BM {proximoCodigo}</strong>
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "16px" }}>
                      {/* Consultor / Instrutor - Versão Curta */}
                      <div className="form-field">
                        <label style={{ fontSize: "11px", fontWeight: 700 }}>Consultor / Prestador * (Versão Curta)</label>
                        <select
                          value={consultorSelecionadoNome}
                          onChange={(e) => setConsultorSelecionadoNome(e.target.value)}
                        >
                          {CONSULTORES_DISPONIVEIS.map((c, i) => (
                            <option key={i} value={c.nome}>
                              {c.nome} {c.cnpj ? \`(\${c.cnpj})\` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Ano de Referência */}
                      <div className="form-field">
                        <label style={{ fontSize: "11px", fontWeight: 700 }}>Ano de Referência *</label>
                        <select
                          value={anoReferencia}
                          onChange={(e) => setAnoReferencia(e.target.value)}
                        >
                          {anosDisponiveis.map((a) => (
                            <option key={a} value={String(a)}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Mês de Referência com indicação de lançamentos */}
                      <div className="form-field">
                        <label style={{ fontSize: "11px", fontWeight: 700 }}>Mês de Referência *</label>
                        <select
                          value={mesReferenciaNum}
                          onChange={(e) => setMesReferenciaNum(Number(e.target.value))}
                        >
                          {MESES_LISTA.map((m) => {
                            const temLanc = mesesComLancamentos.includes(m.num);
                            return (
                              <option key={m.num} value={m.num}>
                                {m.nome} {temLanc ? "✓ (Com lançamentos)" : "— (Sem lançamentos)"}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Período da Medição */}
                      <div className="form-field">
                        <label style={{ fontSize: "11px", fontWeight: 700 }}>Período da Medição *</label>
                        <select
                          value={periodoTipo}
                          onChange={(e) => setPeriodoTipo(e.target.value as "1ª Quinzena" | "2ª Quinzena" | "Integral")}
                        >
                          <option value="1ª Quinzena">1ª Quinzena (Início do Mês até Corte)</option>
                          <option value="2ª Quinzena">2ª Quinzena (Corte até Fim do Mês)</option>
                          <option value="Integral">Integral (Mês Cheio)</option>
                        </select>
                      </div>

                      {/* Data de Corte */}
                      <div className="form-field">
                        <label style={{ fontSize: "11px", fontWeight: 700 }}>Data de Corte (Divisão de Quinzenas) *</label>
                        <input
                          type="text"
                          value={dataCorte}
                          placeholder="Ex: 15/09/2026"
                          onChange={(e) => setDataCorte(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Resumo Pré-visualizado dos Dados da Gestão de Projetos */}
                    <div style={{ backgroundColor: "var(--surface-container-low)", padding: "16px 20px", borderRadius: "10px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", flexWrap: "wrap" }}>
                          <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: "22px" }}>hub</span>
                          {carregandoProjetos ? (
                            <span style={{ color: "var(--secondary)", fontWeight: 600 }}>
                              Consultando base de dados dos Projetos...
                            </span>
                          ) : previewAtividades.length > 0 ? (
                            <>
                              <span style={{ padding: "2px 8px", borderRadius: "999px", backgroundColor: "#d1fae5", color: "#065f46", fontWeight: 700, fontSize: "11px" }}>
                                ● Base de Projetos Conectada
                              </span>
                              <span>
                                <strong>{previewAtividades.length} lançamentos</strong> vinculados ({mesReferenciaFormatado})
                              </span>
                              <span style={{ color: "var(--outline)" }}>•</span>
                              <span>
                                Carga Horária: <strong>{previewTotalHoras.toFixed(1)} h</strong>
                              </span>
                              <span style={{ color: "var(--outline)" }}>•</span>
                              <span>
                                Valor Total: <strong style={{ color: "var(--primary)" }}>R$ {previewValorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                              </span>
                            </>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ padding: "2px 8px", borderRadius: "999px", backgroundColor: "#fef3c7", color: "#92400e", fontWeight: 700, fontSize: "11px" }}>
                                Sem Lançamentos
                              </span>
                              <span style={{ color: "var(--on-surface-variant)" }}>
                                Nenhum lançamento na base de Projetos para <strong>{consultorSelecionadoNome}</strong> em <strong>{mesReferenciaFormatado}</strong>.
                              </span>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleIniciarGeracaoBM}
                          className="btn-primary"
                          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "8px 18px", backgroundColor: "var(--secondary)" }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>description</span>
                          <span>Gerar BM {proximoCodigo}</span>
                        </button>
                      </div>

                      {/* Tabela de Lançamentos Vinculados em Tempo Real */}
                      {previewAtividades.length > 0 && (
                        <div style={{ maxHeight: "160px", overflowY: "auto", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                          <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse", textAlign: "left" }}>
                            <thead>
                              <tr style={{ color: "var(--on-surface-variant)" }}>
                                <th style={{ padding: "4px 8px" }}>Projeto</th>
                                <th style={{ padding: "4px 8px" }}>Atividade</th>
                                <th style={{ padding: "4px 8px", textAlign: "center" }}>Período</th>
                                <th style={{ padding: "4px 8px", textAlign: "right" }}>Horas</th>
                                <th style={{ padding: "4px 8px", textAlign: "right" }}>Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewAtividades.map((at, idx) => (
                                <tr key={idx} style={{ borderTop: "1px dashed var(--border)" }}>
                                  <td style={{ padding: "4px 8px", fontWeight: 600, color: "var(--primary)" }}>{at.projeto}</td>
                                  <td style={{ padding: "4px 8px" }}>{at.atividade}</td>
                                  <td style={{ padding: "4px 8px", textAlign: "center", color: "var(--on-surface-variant)" }}>{at.periodo}</td>
                                  <td style={{ padding: "4px 8px", textAlign: "right" }}>{at.horas.toFixed(1)} h</td>
                                  <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 700 }}>R$ {at.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* BARRA DE PESQUISA E FILTROS DE STATUS DO WORKFLOW */}`;

content = content.replace(regexOldFormHtml, newFormHtml);

fs.writeFileSync(targetFile, content, 'utf-8');
console.log('Etapa 2 concluída com sucesso!');
