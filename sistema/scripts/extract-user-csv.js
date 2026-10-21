const fs = require('fs');

const transcriptPath = 'C:/Users/Leonardo Campos/.gemini/antigravity-ide/brain/d85d30a6-c79d-417a-88ea-a2024a4f272a/.system_generated/logs/transcript_full.jsonl';
const fileData = fs.readFileSync(transcriptPath, 'utf8');
const lines = fileData.split('\n');

for (let i = lines.length - 1; i >= 0; i--) {
  const line = lines[i];
  if (line.includes('"type":"USER_INPUT"') || line.includes('"type": "USER_INPUT"')) {
    try {
      const obj = JSON.parse(line);
      console.log('Step index:', obj.step_index, 'Content length:', obj.content ? obj.content.length : 0);
      if (obj.content && obj.content.includes('REALIZADO,DATA PGTO')) {
        fs.writeFileSync('scripts/user_msg_csv.txt', obj.content, 'utf8');
        console.log('Salvo com sucesso scripts/user_msg_csv.txt!');
        break;
      }
    } catch(e) {}
  }
}
