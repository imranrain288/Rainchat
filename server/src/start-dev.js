import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('\x1b[36m%s\x1b[0m', '==================================================');
console.log('\x1b[35m%s\x1b[0m', '🚀 Launching MERN Real-time Messaging Platform...');
console.log('\x1b[36m%s\x1b[0m', '==================================================');

const server = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, 'server'),
  stdio: 'inherit',
  shell: true
});

const client = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, 'client'),
  stdio: 'inherit',
  shell: true
});

function cleanup() {
  console.log('\nGracefully shutting down services...');
  server.kill('SIGINT');
  client.kill('SIGINT');
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
