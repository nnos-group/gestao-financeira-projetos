import sharp from 'sharp';
import fs from 'node:fs';

async function removerFundo(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  // Cria cópia dos pixels manipulando o canal alpha
  const outData = Buffer.from(data);

  for (let i = 0; i < outData.length; i += channels) {
    const r = outData[i];
    const g = outData[i + 1];
    const b = outData[i + 2];

    // Se o pixel for praticamente branco (tolerância para artefatos de compressão > 245)
    if (r > 240 && g > 240 && b > 240) {
      // Suaviza a borda se estiver entre 240 e 255
      const minVal = Math.min(r, g, b);
      if (minVal > 250) {
        outData[i + 3] = 0; // 100% transparente
      } else {
        // Transição suave
        const alpha = Math.floor(((255 - minVal) / 15) * 255);
        outData[i + 3] = alpha;
      }
    }
  }

  await sharp(outData, {
    raw: {
      width,
      height,
      channels,
    },
  })
    .png()
    .toFile(outputPath);

  console.log(`Fundo removido com sucesso: ${outputPath} (${width}x${height})`);
}

await removerFundo('public/logo-coruja.png', 'public/logo-coruja-transparente.png');
// Substitui a original
fs.copyFileSync('public/logo-coruja-transparente.png', 'public/logo-coruja.png');
console.log('Logo atualizada com fundo transparente!');
