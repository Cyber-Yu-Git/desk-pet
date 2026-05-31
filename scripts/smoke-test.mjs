import { existsSync } from 'node:fs';
import { join } from 'node:path';

const requiredFiles = [
  'package.json',
  'electron.vite.config.ts',
  'src/main/index.ts',
  'src/main/chat/chatHistoryStore.ts',
  'src/main/chat/deepSeekClient.ts',
  'src/main/chat/validateChatInput.ts',
  'src/preload/index.ts',
  'src/renderer/index.html',
  'src/renderer/src/main.tsx',
  'src/shared/ipcChannels.ts',
  'src/shared/eventNames.ts',
  'src/shared/types.ts'
];

const missing = requiredFiles.filter((file) => !existsSync(join(process.cwd(), file)));

if (missing.length > 0) {
  console.error(`Smoke test failed. Missing files:\n${missing.join('\n')}`);
  process.exit(1);
}

console.log('Smoke test passed.');
