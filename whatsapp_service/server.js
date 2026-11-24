const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');

const PORT = process.env.PORT || 8086;

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

let sock = null;
let connectionStatus = 'init'; // 'init' | 'qr_ready' | 'connecting' | 'connected' | 'disconnected'
let qrImage = null;
let userInfo = null;
const sentLogs = [];

function formatJid(number) {
  if (!number) return null;
  let clean = number.toString().replace(/\D/g, '');
  if (clean.length === 10 || clean.length === 11) {
    clean = '55' + clean;
  }
  return `${clean}@s.whatsapp.net`;
}

async function startWhatsApp() {
  connectionStatus = 'connecting';
  const authDir = path.join(__dirname, 'auth_info_baileys');
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['MyRose Studio', 'Chrome', '2.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrImage = await qrcode.toDataURL(qr);
      connectionStatus = 'qr_ready';
      console.log('\n======================================================');
      console.log(' [MyRose WhatsApp] NOVO QR CODE GERADO!');
      console.log(` Abra no navegador: http://localhost:${PORT}/qrcode`);
      console.log(' Ou escaneie direto na aba Automações do MyRose.');
      console.log('======================================================\n');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.status;
      const isReplaced = statusCode === DisconnectReason.connectionReplaced;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const shouldReconnect = !isLoggedOut && !isReplaced;
      connectionStatus = isReplaced ? 'replaced' : isLoggedOut ? 'logged_out' : 'disconnected';
      userInfo = null;

      if (shouldReconnect) {
        setTimeout(startWhatsApp, 3000);
      }
    } else if (connection === 'open') {
      connectionStatus = 'connected';
      qrImage = null;
      userInfo = sock.user;
      console.log('\n======================================================');
      console.log(' [MyRose WhatsApp] CONECTADO COM SUCESSO!');
      console.log(` Conta conectada: ${sock.user?.id}`);
      console.log('======================================================\n');
    }
  });

  // Assistente Rose IA integrada no WhatsApp (comandos rápidos)
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      const remoteJid = msg.key.remoteJid;
      if (!remoteJid || !remoteJid.endsWith('@s.whatsapp.net')) continue;

      const text = (
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        ''
      ).trim();

      if (!text.startsWith('!')) continue;
      const cmd = text.toLowerCase();

      if (cmd === '!ajuda' || cmd === '!rose') {
        await sock.sendMessage(remoteJid, {
          text:
            '🌹 *Assistente Rose IA — MyRose*\n\n' +
            'Comandos disponíveis:\n' +
            '• *!ajuda* — Exibe este menu\n' +
            '• *!painel* — Link direto do seu painel MyRose\n' +
            '• *!agendar* — Link público de agendamento 24h\n' +
            '• *!status* — Verifica status do servidor WhatsApp',
        });
      } else if (cmd === '!painel') {
        await sock.sendMessage(remoteJid, {
          text: '🌹 Acesse seu painel MyRose: https://myrose-app.pages.dev/dashboard',
        });
      } else if (cmd === '!agendar') {
        await sock.sendMessage(remoteJid, {
          text: '📅 Link público de agendamento: https://myrose-app.pages.dev/agendar/studio-demo',
        });
      } else if (cmd === '!status') {
        await sock.sendMessage(remoteJid, {
          text: `✅ Servidor MyRose WhatsApp ativo! Disparos na sessão: ${sentLogs.length}.`,
        });
      }
    }
  });
}

app.get('/status', (_req, res) => {
  res.json({
    status: connectionStatus,
    user: userInfo,
    hasQr: Boolean(qrImage),
    sentCount: sentLogs.length,
    recentLogs: sentLogs.slice(0, 15),
  });
});

app.get('/qr-data', (_req, res) => {
  res.json({
    status: connectionStatus,
    qrImage,
    user: userInfo,
    sentCount: sentLogs.length,
    recentLogs: sentLogs.slice(0, 15),
  });
});

app.get('/qrcode', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conexão WhatsApp — MyRose</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #fafafa; color: #09090b; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #fff; border: 1px solid #e4e4e7; border-radius: 20px; padding: 32px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06); }
    h1 { font-size: 22px; color: #09090b; margin-bottom: 6px; }
    h1 span { color: #b91c1c; }
    p.sub { color: #71717a; font-size: 13px; margin-bottom: 20px; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    .badge-ready { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .badge-connected { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .qr-frame { background: #fff; padding: 12px; border: 1px solid #e4e4e7; border-radius: 16px; display: inline-block; margin-bottom: 16px; }
    .qr-frame img { display: block; width: 250px; height: 250px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>My<span>Rose</span> WhatsApp</h1>
    <p class="sub">Servidor Local de Lembretes Automáticos & Assistente Rose IA</p>
    <div id="content">Carregando...</div>
  </div>
  <script>
    async function poll() {
      try {
        const r = await fetch('/qr-data');
        const d = await r.json();
        const el = document.getElementById('content');
        if (d.status === 'connected') {
          el.innerHTML = '<div class="badge badge-connected">✅ WhatsApp Conectado</div><p style="font-size:13px;color:#3f3f46">Pronto para enviar confirmações e lembretes diretamente pelo MyRose.</p>';
        } else if (d.status === 'qr_ready' && d.qrImage) {
          el.innerHTML = '<div class="badge badge-ready">Escaneie o QR Code no WhatsApp</div><div class="qr-frame"><img src="' + d.qrImage + '" /></div><p style="font-size:12px;color:#71717a">WhatsApp → Aparelhos Conectados → Conectar Aparelho</p>';
        } else {
          el.innerHTML = '<div class="badge badge-ready">Inicializando sessão...</div>';
        }
      } catch (e) {}
    }
    setInterval(poll, 2500);
    poll();
  </script>
</body>
</html>`);
});

app.post('/message/sendText/:instance', async (req, res) => {
  try {
    const { number, text } = req.body || {};
    if (!number || !text) {
      return res.status(400).json({ error: 'Parâmetros "number" e "text" são obrigatórios' });
    }
    if (!sock || connectionStatus !== 'connected') {
      return res.status(503).json({ error: 'WhatsApp desconectado. Escaneie o QR Code.' });
    }

    const jid = formatJid(number);
    const result = await sock.sendMessage(jid, { text });
    sentLogs.unshift({
      id: result?.key?.id || String(Date.now()),
      number: String(number),
      preview: String(text).slice(0, 80),
      sentAt: new Date().toISOString(),
    });
    if (sentLogs.length > 50) sentLogs.pop();

    return res.json({
      status: 'success',
      key: result?.key,
      message: 'Mensagem enviada com sucesso',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro ao enviar mensagem' });
  }
});

app.post('/logout', async (_req, res) => {
  try {
    if (sock) {
      await sock.logout().catch(() => {});
    }
    const authDir = path.join(__dirname, 'auth_info_baileys');
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }
    qrImage = null;
    userInfo = null;
    connectionStatus = 'disconnected';
    setTimeout(startWhatsApp, 1000);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[MyRose WhatsApp] Rodando em http://localhost:${PORT}`);
  console.log(`[MyRose WhatsApp] QR Code: http://localhost:${PORT}/qrcode`);
  startWhatsApp();
});
