import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'sistema', 'public', 'relatorios-portal');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const files = ['matriz.html', 'uva.html', 'booking.html', 'prospeccao.html'];

const localReportsDir = path.resolve(process.cwd(), '..', '2026 - Relatório Financeiro - NNÓS -26');

for (const f of files) {
  let html = '';
  const localFile = path.join(localReportsDir, f);
  if (fs.existsSync(localFile)) {
    html = fs.readFileSync(localFile, 'utf8');
    console.log(`Lido localmente de: ${localFile}`);
  } else {
    const res = await fetch('https://nnos-group.github.io/relatorio-financeiro-nnos-2026/' + f);
    html = await res.text();
    console.log(`Baixado de GitHub Pages: ${f}`);
  }

  // Injetar base href para garantir que imagens, fontes e CSS funcionem 100%
  if (!html.includes('<base ')) {
    html = html.replace('<head>', '<head>\n<base href="https://nnos-group.github.io/relatorio-financeiro-nnos-2026/">');
  }

  // No matriz.html, contornar autenticação para carregar instantâneo dentro do sistema
  if (f === 'matriz.html') {
    html = html.replace('id="login-overlay"', 'id="login-overlay" class="hidden" style="display:none !important;"');
    html = html.replace('id="report-wrapper" class="hidden', 'id="report-wrapper" class="');
    html = html.replace("sessionStorage.getItem('nnos_auth') === 'true'", 'true');
    html = html.replace('sessionStorage.getItem("nnos_auth") === "true"', 'true');
  }

  fs.writeFileSync(path.join(dir, f), html, 'utf8');
  console.log(`Salvo com sucesso: ${f} (${html.length} bytes)`);
}

console.log('Todos os relatórios prontos!');
