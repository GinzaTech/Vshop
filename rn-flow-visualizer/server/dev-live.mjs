import { spawn } from 'node:child_process';

const commands = [
  ['node', ['server/trace-server.mjs']],
  ['npx', ['vite', '--host', '127.0.0.1', '--port', '5173']],
];

const children = commands.map(([command, args]) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[dev-live] ${command} exited with code ${code}`);
      process.exit(code);
    }
  });

  return child;
});

function shutdown() {
  for (const child of children) {
    child.kill();
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
