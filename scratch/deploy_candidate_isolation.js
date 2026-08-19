const path = require('path');
const { Client } = require(path.join(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
const host = "200.234.35.204";
const username = "root";
const password = "K3pZ5twSg#oUI?X6";

console.log(`Connecting to VPS at ${host}...`);

conn.on('ready', () => {
  console.log('Connected! Pulling latest commits and rebuilding services...');

  const cmd = [
    "cd /var/www/qution-softower || cd /var/www/niva-vupa-qution-spftower",
    "git pull origin main",
    "cd backend && npm run build",
    "cd ../admin-portal && npm run build",
    "pm2 restart all",
    "pm2 status"
  ].join(' && ');

  conn.exec(cmd, { pty: true }, (err, stream) => {
    if (err) throw err;

    stream.on('close', (code, signal) => {
      console.log(`\n\nDeployment finished with exit code: ${code}`);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).on('error', (err) => {
  console.error('Connection error:', err);
}).connect({
  host,
  port: 22,
  username,
  password,
  readyTimeout: 30000,
});
