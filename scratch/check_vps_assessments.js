const path = require('path');
const { Client } = require(path.join(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
const host = "200.234.35.204";
const username = "root";
const password = "K3pZ5twSg#oUI?X6";

conn.on('ready', () => {
  const checkCmd = `node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); async function check() { const list = await prisma.assessment.findMany({ select: { id: true, name: true, slug: true, status: true, activeFrom: true, activeUntil: true, durationMins: true } }); console.log(JSON.stringify(list, null, 2)); await prisma.\\$disconnect(); } check();"`;

  conn.exec(`cd /var/www/qution-softower/backend || cd /var/www/niva-vupa-qution-spftower/backend ; ${checkCmd}`, { pty: true }, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', (data) => process.stdout.write(data));
  });
}).connect({ host, port: 22, username, password, readyTimeout: 30000 });
