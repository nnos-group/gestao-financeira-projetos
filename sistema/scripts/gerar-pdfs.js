const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function convertJpgToPdf(jpgPath, pdfPath) {
  const meta = await sharp(jpgPath).metadata();
  const width = meta.width;
  const height = meta.height;
  const jpgData = fs.readFileSync(jpgPath);

  // PDF 1.4 com XObject Image DCTDecode
  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;
  const streamContent = `q ${width} 0 0 ${height} 0 0 cm /Im1 Do Q`;
  const obj5 = `5 0 obj\n<< /Length ${Buffer.byteLength(streamContent)} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
  const obj4Header = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpgData.length} >>\nstream\n`;
  const obj4Footer = '\nendstream\nendobj\n';

  const parts = [
    Buffer.from('%PDF-1.4\n'),
    Buffer.from(obj1),
    Buffer.from(obj2),
    Buffer.from(obj3),
    Buffer.from(obj4Header),
    jpgData,
    Buffer.from(obj4Footer),
    Buffer.from(obj5)
  ];

  let offset = Buffer.from('%PDF-1.4\n').length;
  const off1 = offset; offset += Buffer.from(obj1).length;
  const off2 = offset; offset += Buffer.from(obj2).length;
  const off3 = offset; offset += Buffer.from(obj3).length;
  const off4 = offset; offset += Buffer.from(obj4Header).length + jpgData.length + Buffer.from(obj4Footer).length;
  const off5 = offset; offset += Buffer.from(obj5).length;

  const xref = `xref\n0 6\n0000000000 65535 f \n${String(off1).padStart(10, '0')} 00000 n \n${String(off2).padStart(10, '0')} 00000 n \n${String(off3).padStart(10, '0')} 00000 n \n${String(off4).padStart(10, '0')} 00000 n \n${String(off5).padStart(10, '0')} 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`;

  parts.push(Buffer.from(xref));
  fs.writeFileSync(pdfPath, Buffer.concat(parts));
  console.log('PDF gerado com sucesso:', pdfPath);
}

const dir = path.join(__dirname, '../public/politicas');
(async () => {
  await convertJpgToPdf(path.join(dir, 'politica-cnh.jpg'), path.join(dir, 'politica-cnh.pdf'));
  await convertJpgToPdf(path.join(dir, 'politica-nnos.jpg'), path.join(dir, 'politica-nnos.pdf'));
  await convertJpgToPdf(path.join(dir, 'politica-iveco.jpg'), path.join(dir, 'politica-iveco.pdf'));
  await convertJpgToPdf(path.join(dir, 'politica-reembolso-nnos.jpg'), path.join(dir, 'politica-reembolso-nnos.pdf'));
})();
