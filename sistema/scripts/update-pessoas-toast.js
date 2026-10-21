const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/app/pessoas/page.tsx');
let content = fs.readFileSync(targetFile, 'utf-8');

// 1. Atualizar a mensagem para a versão curta "Ficha salva com sucesso"
content = content.replace(
  'setToastMsg("✅ Ficha salva com sucesso e gravada permanentemente no sistema!");',
  'setToastMsg("Ficha salva com sucesso");'
);

content = content.replace(
  'setToastMsg("✅ Salvo no navegador!");',
  'setToastMsg("Ficha salva com sucesso");'
);

// 2. Substituir o componente de toast pelo design moderno correspondente ao SVG fornecido
const oldToastBlock = `{/* Notificação Toast de Persistência */}
        {toastMsg && (
          <div
            style={{
              position: "fixed",
              top: "20px",
              right: "24px",
              zIndex: 9999,
              backgroundColor: "#15803d",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: "8px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              fontSize: "13px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <span>{toastMsg}</span>
          </div>
        )}`;

const newToastBlock = `{/* Notificação Toast Moderna Conforme Design Aprovado (Print 1) */}
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
            {/* Barra lateral esmeralda de acento */}
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

            {/* Ícone com aura menta e círculo esmeralda com checkmark */}
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

            {/* Texto curto oficial */}
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

            {/* Botão de Fechar sutil */}
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

if (content.includes(oldToastBlock)) {
  content = content.replace(oldToastBlock, newToastBlock);
  fs.writeFileSync(targetFile, content, 'utf-8');
  console.log('Toast de pessoas/page.tsx atualizado com sucesso!');
} else {
  console.error('Bloco antigo de toast não encontrado em pessoas/page.tsx');
}
