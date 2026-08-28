const express = require('express');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

let sock;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('--- ESCANEA ESTE CÓDIGO QR CON WHATSAPP ---');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada. Reconectando...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('¡Conexión a WhatsApp establecida con éxito!');
        }
    });
}

connectToWhatsApp();

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

        // Pausa de 3 segundos entre envíos para protección de la cuenta
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
