import { existsSync } from 'node:fs';
import { join } from 'node:path';

const requiredFiles = [
  'package.json',
  'MVP内测验收清单.md',
  '内测反馈模板.md',
  'build/icon.ico',
  'build/icon.png',
  'electron.vite.config.ts',
  'scripts/generate-icon.mjs',
  'src/main/index.ts',
  'src/main/agent/agentTaskStore.ts',
  'src/main/agent/validateAgentTaskInput.ts',
  'src/main/chat/chatHistoryStore.ts',
  'src/main/chat/deepSeekClient.ts',
  'src/main/chat/validateChatInput.ts',
  'src/main/memory/memoryStore.ts',
  'src/main/memory/validateMemoryInput.ts',
  'src/main/settings/settingsStore.ts',
  'src/main/share/validateShareInput.ts',
  'src/main/todo/todoStore.ts',
  'src/main/todo/validateTodoInput.ts',
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
