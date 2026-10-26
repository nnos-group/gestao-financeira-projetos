const fs = require('fs');
const path = require('path');
const { createClient } = require(path.resolve(__dirname, '../node_modules/@supabase/supabase-js'));
const env = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf-8');
const envVars = {};
env.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    envVars[k] = v;
  }
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: lancs } = await supabase.from('lancamentos').select('id, atividade, local, regiao, viagens(*)').ilike('local', '%Sorocaba%');
  console.log('Lancamentos Sorocaba:', JSON.stringify(lancs, null, 2));

  const { data: confs } = await supabase.from('configuracoes').select('chave');
  console.log('Chaves configuracoes:', confs);
}
check();
