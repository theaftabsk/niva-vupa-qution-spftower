const path = require('path');
const { Client } = require(path.join(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
const host = "200.234.35.204";
const username = "root";
const password = "K3pZ5twSg#oUI?X6";

console.log(`Connecting to VPS at ${host} for complete Health Audit...\n`);

conn.on('ready', () => {
  const healthCmd = [
    "echo '=== 1. SYSTEM UPTIME & LOAD AVERAGE ==='",
    "uptime",
    "echo '\n=== 2. MEMORY / RAM UTILIZATION ==='",
    "free -m -h",
    "echo '\n=== 3. DISK STORAGE HEALTH ==='",
    "df -h /",
    "echo '\n=== 4. PM2 PROCESS ECOSYSTEM STATUS ==='",
    "pm2 list",
    "echo '\n=== 5. OPEN PORTS & SERVICES ==='",
    "netstat -tuln | grep -E ':(80|443|3000|3001|3002|3003|5432)' || ss -tuln | grep -E ':(80|443|3000|3001|3002|3003|5432)'",
    "echo '\n=== 6. POSTGRESQL DATABASE HE
    ALTH ==='",
    "systemctl is-active postgresql",
    "echo '\n=== 7. NGINX REVERSE PROXY HEALTH ==='",
    "systemctl is-active nginx"
  ].join(' && ');

  conn.exec(healthCmd, { pty: true }, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      console.log('\n=== HEALTH CHECK COMPLETED ===');
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).connect({ host, port: 22, username, password, readyTimeout: 30000 });
