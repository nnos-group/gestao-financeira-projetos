import sharp from 'sharp';

async function gerarLogoBranca() {
  const { data, info } = await sharp('public/logo-coruja-transparente.png')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const outData = Buffer.from(data);

  for (let i = 0; i < outData.length; i += channels) {
    const alpha = outData[i + 3];
    // Se o pixel tem opacidade (é parte do traço da coruja)
    if (alpha > 10) {
      outData[i] = 255;     // R
      outData[i + 1] = 255; // G
      outData[i + 2] = 255; // B
    }
  }

  await sharp(outData, {
    raw: { width, height, channels },
  })
    .png()
    .toFile('public/logo-coruja-branca.png');

  console.log(`Logo branca criada com sucesso em public/logo-coruja-branca.png (${width}x${height})`);
}

gerarLogoBranca();
