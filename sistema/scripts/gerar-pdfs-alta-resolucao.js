const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function convertJpgToHighResPdf(origJpgPath, pdfPath, enhancedJpgPath) {
  const origBuffer = fs.readFileSync(origJpgPath);
  const meta = await sharp(origBuffer).metadata();
  const targetWidth = Math.round(meta.width * 2.5); // ~1800px a 2000px

  const enhancedBuffer = await sharp(origBuffer)
    .resize(targetWidth, null, {
      kernel: sharp.kernel.lanczos3,
      fit: 'inside',
    })
    .sharpen({
      sigma: 1.2,
      m1: 1.5,
      m2: 0.7,
    })
    .jpeg({ quality: 98, chromaSubsampling: '4:4:4' })
    .toBuffer();

  // Salva imagem aprimorada
  fs.writeFileSync(enhancedJpgPath, enhancedBuffer);

  const enhancedMeta = await sharp(enhancedBuffer).metadata();
  const w = enhancedMeta.width;
  const h = enhancedMeta.height;

  // Tamanho A4 proporcional (595.28 x 841.89 pt) para densidade ideal
  const a4Width = 595.28;
  const a4Height = 841.89;

  // Ajusta na folha A4 com margens
  const scale = Math.min((a4Width - 20) / w, (a4Height - 20) / h);
  const renderWidth = (w * scale).toFixed(2);
  const renderHeight = (h * scale).toFixed(2);
  const posX = (((a4Width - (w * scale)) / 2)).toFixed(2);
  const posY = (((a4Height - (h * scale)) / 2)).toFixed(2);

  // PDF 1.4 com XObject Image DCTDecode e Interpolate true
  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${a4Width} ${a4Height}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;
  const streamContent = `q ${renderWidth} 0 0 ${renderHeight} ${posX} ${posY} cm /Im1 Do Q`;
  const obj5 = `5 0 obj\n<< /Length ${Buffer.byteLength(streamContent)} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
  const obj4Header = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Interpolate true /Length ${enhancedBuffer.length} >>\nstream\n`;
  const obj4Footer = '\nendstream\nendobj\n';

  const parts = [
    Buffer.from('%PDF-1.4\n'),
    Buffer.from(obj1),
    Buffer.from(obj2),
    Buffer.from(obj3),
    Buffer.from(obj4Header),
    enhancedBuffer,
    Buffer.from(obj4Footer),
    Buffer.from(obj5)
  ];

  let offset = Buffer.from('%PDF-1.4\n').length;
  const off1 = offset; offset += Buffer.from(obj1).length;
  const off2 = offset; offset += Buffer.from(obj2).length;
  const off3 = offset; offset += Buffer.from(obj3).length;
  const off4 = offset; offset += Buffer.from(obj4Header).length + enhancedBuffer.length + Buffer.from(obj4Footer).length;
  const off5 = offset; offset += Buffer.from(obj5).length;

  const xref = `xref\n0 6\n0000000000 65535 f \n${String(off1).padStart(10, '0')} 00000 n \n${String(off2).padStart(10, '0')} 00000 n \n${String(off3).padStart(10, '0')} 00000 n \n${String(off4).padStart(10, '0')} 00000 n \n${String(off5).padStart(10, '0')} 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`;

  parts.push(Buffer.from(xref));
  fs.writeFileSync(pdfPath, Buffer.concat(parts));
  console.log('PDF de Alta Resolução gerado com sucesso:', pdfPath, `(${w}x${h} px, ${enhancedBuffer.length} bytes)`);
}

const dir = path.join(__dirname, '../public/politicas');
(async () => {
  await convertJpgToHighResPdf(path.join(dir, 'politica-cnh.jpg'), path.join(dir, 'politica-cnh.pdf'), path.join(dir, 'politica-cnh-hd.jpg'));
  await convertJpgToHighResPdf(path.join(dir, 'politica-nnos.jpg'), path.join(dir, 'politica-nnos.pdf'), path.join(dir, 'politica-nnos-hd.jpg'));
  await convertJpgToHighResPdf(path.join(dir, 'politica-iveco.jpg'), path.join(dir, 'politica-iveco.pdf'), path.join(dir, 'politica-iveco-hd.jpg'));
  await convertJpgToHighResPdf(path.join(dir, 'politica-reembolso-nnos.jpg'), path.join(dir, 'politica-reembolso-nnos.pdf'), path.join(dir, 'politica-reembolso-nnos-hd.jpg'));
})();
