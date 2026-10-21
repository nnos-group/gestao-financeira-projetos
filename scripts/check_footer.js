const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('http://localhost:3000/projetos?mes=9', { waitUntil: 'networkidle0' });
  
  const footerCard = await page.$('.sidebar-footer-card');
  if (footerCard) {
    await footerCard.screenshot({ path: 'sistema/public/test-footer.png' });
    console.log('Screenshot tirado com sucesso!');
  } else {
    console.log('Não achou footer card');
  }
  
  const imgHandle = await page.$('.sidebar-footer-card img');
  if (imgHandle) {
    const src = await page.evaluate(el => el.src, imgHandle);
    console.log('SRC da imagem:', src);
  }

  await browser.close();
})();
