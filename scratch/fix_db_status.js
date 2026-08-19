const path = require('path');
const { Client } = require(path.join(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
const host = "200.234.35.204";
const username = "root";
const password = "K3pZ5twSg#oUI?X6";

conn.on('ready', () => {
  const updateCmd = `node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); async function fix() { await prisma.assessment.updateMany({ where: { status: 'UPCOMING' }, data: { status: 'ACTIVE' } }); console.log('Successfully set UPCOMING rows to ACTIVE in DB.'); await prisma.\\$disconnect(); } fix();"`;

  conn.exec(`cd /var/www/qution-softower/backend || cd /var/www/niva-vupa-qution-spftower/backend ; ${updateCmd}`, { pty: true }, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', (data) => process.stdout.write(data));
  });
}).connect({ host, port: 22, username, password, readyTimeout: 30000 });
