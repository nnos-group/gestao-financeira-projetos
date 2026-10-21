const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/app/medicao/page.tsx');
let content = fs.readFileSync(targetFile, 'utf-8');

// 1. Substituir INITIAL_BMS
const regexInitial = /\/\/ BMs Iniciais cadastrados\r?\nconst INITIAL_BMS: BoletimMedicaoItem\[\] = \[[\s\S]*?\r?\n\];\r?\n/;
if (!regexInitial.test(content)) {
  console.error('Regex INITIAL_BMS não bateu!');
  process.exit(1);
}
content = content.replace(regexInitial, 'const INITIAL_BMS: BoletimMedicaoItem[] = bms2026Base as unknown as BoletimMedicaoItem[];\n\n');

// 2. Substituir CONSULTORES_DISPONIVEIS
const regexConsultores = /const CONSULTORES_DISPONIVEIS = \[[\s\S]*?\r?\n\];\r?\n/;
if (!regexConsultores.test(content)) {
  console.error('Regex CONSULTORES_DISPONIVEIS não bateu!');
  process.exit(1);
}
const novoConsultores = `const CONSULTORES_DISPONIVEIS = (consultoresBase as any[])
  .filter((c: any) => c.ativo !== false)
  .map((c: any) => ({
    nome: c.nome_completo || c.nome,
    cnpj: c.cnpj || '',
    email: c.email || '',
    endereco: c.endereco_empresa || c.cidade_base || '',
    contrato: c.contrato_ativo ? (c.contrato_ativo + ' • NNÓS') : 'Contrato Vigente • NNÓS',
  }));\n\n`;
content = content.replace(regexConsultores, novoConsultores);

// 3. Adicionar useEffect e salvarBms logo após useState<BoletimMedicaoItem | null>(null);
const posBmVis = 'const [bmVisualizando, setBmVisualizando] = useState<BoletimMedicaoItem | null>(null);';
const syncSnippet = `const [bmVisualizando, setBmVisualizando] = useState<BoletimMedicaoItem | null>(null);

  // Sincronização e persistência de dados dos BMs
  useEffect(() => {
    try {
      const local = localStorage.getItem('nnos_bms_2026_v1');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBmsLista(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn('Erro ao ler localStorage de BMs', e);
    }

    fetch('/api/medicao')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setBmsLista(data);
          try {
            localStorage.setItem('nnos_bms_2026_v1', JSON.stringify(data));
          } catch {}
        }
      })
      .catch((err) => console.warn('Erro ao buscar /api/medicao', err));
  }, []);

  const salvarBms = (novos: BoletimMedicaoItem[]) => {
    setBmsLista(novos);
    try {
      localStorage.setItem('nnos_bms_2026_v1', JSON.stringify(novos));
    } catch {}
    fetch('/api/medicao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novos),
    }).catch((e) => console.error('Erro ao salvar /api/medicao', e));
  };`;

content = content.replace(posBmVis, syncSnippet);

// 4. Salvar via salvarBms no envio de assinatura
content = content.replace('setBmsLista((prev) => [novoBMCompleto, ...prev]);', 'salvarBms([novoBMCompleto, ...bmsLista]);');

// 5. Salvar via salvarBms no avanço de assinatura
const regexAvanco = /setBmsLista\(\(prev\) =>\r?\n\s+prev\.map\(\(item\) => \{[\s\S]*?\}\)\r?\n\s+\);/;
const avancoNovo = `const novosBms = bmsLista.map((item) => {
      if (item.id !== bm.id) return item;

      if (item.status === "Pendente de Assinatura") {
        const novosLogs: LogSignatario[] = [
          {
            ...item.logs[0],
            status: "Assinado",
            dataHora: dataHoraStr,
            detalhe: "IP: 189.44.112.5 • Assinado via NNÓS Sign",
          },
          item.logs[1] || { signatario: "LÍDER DE PROJETO", papel: "Aprovador", email: "projetos@nnos.com.br", status: "Pendente" },
          item.logs[2] || { signatario: "MARCELO LARA", papel: "Coordenação", email: "marcelo.lara@nnos.com.br", status: "Pendente" },
        ];
        showToast("Assinatura do prestador (" + item.consultorNome + ") registrada!");
        return {
          ...item,
          status: "Assinado pelo Prestador" as const,
          logs: novosLogs,
        };
      } else if (item.status === "Assinado pelo Prestador") {
        const novosLogs: LogSignatario[] = [
          item.logs[0],
          {
            ...(item.logs[1] || { signatario: item.liderProjetoNome, papel: "Aprovador", email: item.liderProjetoEmail }),
            status: "Assinado",
            dataHora: dataHoraStr,
            detalhe: "Aprovado pelo líder " + item.liderProjetoNome,
          },
          item.logs[2] || { signatario: "MARCELO LARA", papel: "Coordenação", email: "marcelo.lara@nnos.com.br", status: "Pendente" },
        ];
        showToast("Aprovação do Líder de Projeto (" + item.liderProjetoNome + ") concluída!");
        return {
          ...item,
          status: "Aprovado pelo Líder" as const,
          logs: novosLogs,
        };
      } else if (item.status === "Aprovado pelo Líder") {
        const novosLogs: LogSignatario[] = [
          item.logs[0],
          item.logs[1],
          {
            ...(item.logs[2] || { signatario: item.responsavelNnosNome, papel: "Coordenação Geral", email: item.responsavelNnosEmail }),
            status: "Assinado",
            dataHora: dataHoraStr,
            detalhe: "Homologado para faturamento financeiro",
          },
        ];
        showToast("BM " + item.codigo + " Aprovado & Pronto para Faturamento!");
        return {
          ...item,
          status: "Aprovado & Pronto p/ Faturamento" as const,
          logs: novosLogs,
        };
      }
      return item;
    });
    salvarBms(novosBms);`;

content = content.replace(regexAvanco, avancoNovo);

fs.writeFileSync(targetFile, content, 'utf-8');
console.log('Arquivo atualizado com sucesso!');
