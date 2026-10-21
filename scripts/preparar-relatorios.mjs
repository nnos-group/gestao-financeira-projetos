import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'sistema', 'public', 'relatorios-portal');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const files = ['matriz.html', 'uva.html', 'booking.html', 'prospeccao.html', 'lider.html'];

for (const f of files) {
  const res = await fetch('https://nnos-group.github.io/relatorio-financeiro-nnos-2026/' + f);
  let html = await res.text();

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

  // No lider.html, corrigir formato de números e percentuais para o padrão brasileiro (0.000,00)
  if (f === 'lider.html') {
    html = html.replaceAll('-3,214,89%', '-3.214,89%')
               .replaceAll('3,062,49%', '3.062,49%')
               .replaceAll('-1,048,89%', '-1.048,89%')
               .replaceAll('1,136,64%', '1.136,64%')
               .replaceAll('Custos: 3062.5%', 'Custos: 3.062,5%')
               .replaceAll('Margem: -3214.9%', 'Margem: -3.214,9%')
               .replaceAll('Custos: 1136.6%', 'Custos: 1.136,6%')
               .replaceAll('Margem: -1048.9%', 'Margem: -1.048,9%');
  }

  fs.writeFileSync(path.join(dir, f), html, 'utf8');
  console.log(`Salvo com sucesso: ${f} (${html.length} bytes)`);
}

console.log('Todos os relatórios prontos!');
