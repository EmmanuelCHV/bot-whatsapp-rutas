const express = require('express');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');

const app = express();
app.use(express.json());

let sock;
let qrCodeData = null;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCodeData = qr;
            console.log('--- NUEVO CÓDIGO QR GENERADO ---');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            qrCodeData = null;
            console.log('¡Conexión a WhatsApp establecida con éxito!');
        }
    });
}

connectToWhatsApp();

// Ruta para ver el QR desde el navegador
app.get('/qr', async (req, res) => {
    if (!qrCodeData) {
        return res.send('<h3>No hay QR activo o ya estás conectado a WhatsApp.</h3>');
    }
    try {
        const url = await QRCode.toDataURL(qrCodeData);
        res.send(`<h2>Escanea este código con WhatsApp</h2><img src="${url}" style="width:300px;"/>`);
    } catch (err) {
        res.status(500).send('Error generando el QR');
    }
});

app.post('/api/v1/enviar-ruta', async (req, res) => {
    const { mensaje, clientes } = req.body;

    if (!clientes || !Array.isArray(clientes)) {
        return res.status(400).json({ error: 'Lista de clientes no válida' });
    }

    res.json({ status: 'ok', mensaje: `Procesando ${clientes.length} envíos` });

    for (const c of clientes) {
        let num = c.telefono.toString().trim().replace('+', '').replace(/\s+/g, '');
        if (!num.startsWith('52')) {
            num = `52${num}`;
        }

        const chatId = `${num}@s.whatsapp.net`;
        const textoPersonalizado = `Hola ${c.nombre}, ${mensaje}`;

        try {
            await sock.sendMessage(chatId, { text: textoPersonalizado });
            console.log(`Mensaje enviado a ${c.nombre}`);
        } catch (err) {
            console.error(`Error enviando a ${c.nombre}:`, err);
        }

        await new Promise(resolve => setTimeout(resolve, 3000));
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
