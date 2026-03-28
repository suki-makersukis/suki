// DUEL RXV TEAMRXVVX - WHATSAPP BOT (PAIRING CODE VERSION)
// Simpan sebagai index.js

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// ==================== KONFIGURASI ====================
const config = {
    prefix: ".",
    ownerNumber: process.env.OWNER_NUMBER || "6283173495612",
    botName: "DUEL RXV TEAMRXVVX",
    version: "Valentine Edition",
    
    deposit: {
        dana: "6283173495612",
        ovo: "6283173495612", 
        gopay: "6283173495612"
    },
    
    startingCoins: 0,
    fee: { enabled: true, percentage: 5, minFee: 10, maxFee: 5000 }
};

// ==================== DATABASE ====================
let db = { users: {}, games: [], feeWallet: 0, giftCodes: [], jackpotPool: 10000 };

const DB_PATH = '/data/database.json';
const LOCAL_DB_PATH = './database.json';

function loadDatabase() {
    try {
        if (fs.existsSync(DB_PATH)) {
            db = JSON.parse(fs.readFileSync(DB_PATH));
        } else if (fs.existsSync(LOCAL_DB_PATH)) {
            db = JSON.parse(fs.readFileSync(LOCAL_DB_PATH));
            fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        } else {
            fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        }
        console.log('✅ Database loaded');
    } catch (err) {}
}

function saveDB() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2));
    } catch (err) {}
}

loadDatabase();

// ==================== HELPERS ====================
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function cleanNumber(number) {
    return number.replace(/[^0-9]/g, '');
}

function getUser(userJid, pushName) {
    const userId = userJid.split('@')[0];
    if (!db.users[userId]) {
        db.users[userId] = {
            userId, username: pushName || userId,
            coins: config.startingCoins,
            gamesPlayed: 0, gamesWon: 0, gamesLost: 0,
            totalBet: 0, totalWin: 0,
            registerDate: new Date().toISOString()
        };
        saveDB();
    }
    return db.users[userId];
}

function rollDice() {
    return Math.floor(Math.random() * 6) + 1;
}

// ==================== BOT START WITH PAIRING ====================
async function startBot() {
    console.log('🎮 DUEL RXV TEAMRXVVX WhatsApp Bot starting...');
    console.log('📱 Bot akan menggunakan PAIRING CODE (tanpa QR)\n');
    
    const authDir = '/data/auth_info';
    const localAuthDir = './auth_info';
    
    // Buat direktori jika belum ada
    if (!fs.existsSync('/data')) fs.mkdirSync('/data', { recursive: true });
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
    if (!fs.existsSync(localAuthDir)) fs.mkdirSync(localAuthDir, { recursive: true });
    
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Matikan QR
        auth: state,
        browser: ['DUEL RXV', 'Chrome', '1.0.0']
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    // Connection handler
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log('\n✅ BOT BERHASIL TERHUBUNG!');
            console.log(`📱 Bot siap digunakan! Kirim .menu ke WhatsApp\n`);
            
            // Kirim pesan ke owner
            try {
                await sock.sendMessage(config.ownerNumber + '@s.whatsapp.net', 
                    `🎮 *${config.botName}* ONLINE!\n💰 Ketik .menu untuk mulai!`
                );
            } catch (err) {}
            
            rl.close();
            
        } else if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed, reconnecting:', shouldReconnect);
            if (shouldReconnect) {
                setTimeout(() => startBot(), 5000);
            } else {
                console.log('Logged out, please restart');
            }
        }
    });
    
    // Minta nomor WhatsApp untuk pairing
    console.log('📱 MASUKAN NOMOR WHATSAPP ANDA (contoh: 628123456789):');
    console.log('💡 Nomor ini akan menjadi admin bot\n');
    
    rl.question('Nomor: ', async (phoneNumber) => {
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        
        if (cleanNumber.length < 10) {
            console.log('❌ Nomor tidak valid! Minimal 10 digit.');
            console.log('Restart bot dan coba lagi.');
            process.exit(1);
        }
        
        console.log(`\n🔐 Meminta kode pairing untuk ${cleanNumber}...`);
        
        try {
            const code = await sock.requestPairingCode(cleanNumber);
            console.log(`\n✅ KODE PAIRING: ${code}`);
            console.log('📱 CARA MENGGUNAKAN:');
            console.log('1. Buka WhatsApp di HP');
            console.log('2. Masuk ke Pengaturan > Perangkat Tertaut');
            console.log('3. Tap "Tautkan Perangkat"');
            console.log(`4. Masukkan kode: ${code}`);
            console.log('\n⏳ Menunggu koneksi...\n');
        } catch (err) {
            console.error('❌ Gagal mendapatkan kode pairing:', err);
            console.log('Coba lagi dalam beberapa detik...');
            setTimeout(() => startBot(), 5000);
        }
    });
    
    // ==================== MESSAGE HANDLER ====================
    sock.ev.on('messages.upsert', async (msg) => {
        try {
            const m = msg.messages[0];
            if (!m.message || m.key.fromMe) return;
            if (m.key.remoteJid.includes('status')) return;
            
            const from = m.key.remoteJid;
            const sender = m.key.participant || from;
            const senderId = sender.split('@')[0];
            const pushName = m.pushName || senderId;
            
            const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
            if (!text.startsWith(config.prefix)) return;
            
            const args = text.slice(1).trim().split(/ +/);
            const cmd = args.shift().toLowerCase();
            const user = getUser(sender, pushName);
            
            // ==================== MENU ====================
            if (cmd === 'menu') {
                const menu = 
                    `🎮 *${config.botName} - MENU UTAMA*\n\n` +
                    `💰 *JACKPOT:* ${formatNumber(db.jackpotPool)} 🪙\n\n` +
                    
                    `⚔️ *PVP GAMES (5 RONDE)*\n` +
                    `└ .reme [jumlah] - Host Reme\n` +
                    `└ .qeme [jumlah] - Host Qeme\n` +
                    `└ .qq [jumlah] - Host QQ\n` +
                    `└ .csn [jumlah] - Host CSN\n` +
                    `└ .btk [jumlah] - Host BTK\n` +
                    `└ .dirt [jumlah] - Host Dirt\n` +
                    `└ .bc [jumlah] - Host Baccarat\n` +
                    `└ .bj [jumlah] - Host Blackjack\n` +
                    `└ .kb [k/b] [jumlah] - Host KB\n` +
                    `└ .dadu [jumlah] - Host Dadu\n` +
                    `└ .card [jumlah] - Host Kartu\n` +
                    `└ .flip [jumlah] - Host Flip\n\n` +
                    
                    `🤝 *PVH GAMES (VS BOT)*\n` +
                    `└ .hleme [jumlah] - Host Leme\n` +
                    `└ .leme [ID] - Join Leme\n` +
                    `└ .hreme [jumlah] - Host Reme\n` +
                    `└ .reme [ID] - Join Reme\n` +
                    `└ .hlewa [jumlah] - Host Lewa\n` +
                    `└ .lewa [ID] - Join Lewa\n` +
                    `└ .hr [jumlah] - Host Rewa\n` +
                    `└ .rw [ID] - Join Rewa\n\n` +
                    
                    `🎰 *JUDOL HOKI-HOKIAN*\n` +
                    `└ .slot [jumlah] - Slot Machine\n` +
                    `└ .dadu [jumlah] - Dadu Hoki\n` +
                    `└ .kartu [jumlah] - Kartu Hoki\n\n` +
                    
                    `💰 *ECONOMY:*\n` +
                    `└ .depo - Deposit\n` +
                    `└ .tf @nomor [jumlah] - Transfer\n` +
                    `└ .cc - Cek Coin\n` +
                    `└ .lb - Leaderboard\n` +
                    `└ .spin - Spin Gratis\n\n` +
                    
                    `🎁 *GIFT:*\n` +
                    `└ .tukar [kode] - Redeem Gift\n` +
                    `└ .jackpot - Info Jackpot\n` +
                    `└ .rooms - Lihat Room\n` +
                    `└ .cancel [ID] - Batalkan Room\n\n` +
                    
                    `📱 *Deposit:* ${config.deposit.dana}`;
                
                await sock.sendMessage(from, { text: menu });
            }
            
            // ==================== HELP ====================
            else if (cmd === 'help') {
                const help = 
                    `📚 *PANDUAN GAME*\n\n` +
                    `⚔️ *PVP GAME:*\n` +
                    `1. Host: .reme 500\n` +
                    `2. Join: .remej ABC123\n\n` +
                    
                    `🤝 *PVH GAME (VS BOT):*\n` +
                    `1. Host: .hleme 500\n` +
                    `2. Join: .leme ABC123\n\n` +
                    
                    `🎰 *JUDOL:*\n` +
                    `• .slot 1000 - Slot Machine\n` +
                    `• .dadu 1000 - Dadu Hoki\n` +
                    `• .kartu 1000 - Kartu Hoki\n\n` +
                    
                    `💰 *JACKPOT PROGRESSIF:*\n` +
                    `• 10% taruhan masuk jackpot\n` +
                    `• Chance dapat jackpot saat menang besar\n\n` +
                    
                    `📱 *DEPOSIT:* ${config.deposit.dana}`;
                
                await sock.sendMessage(from, { text: help });
            }
            
            // ==================== CEK COIN ====================
            else if (cmd === 'cc') {
                let targetId = senderId;
                let targetName = pushName;
                if (args.length > 0) {
                    const mention = args[0].replace('@', '');
                    targetId = cleanNumber(mention);
                    targetName = db.users[targetId]?.username || targetId;
                }
                const targetUser = db.users[targetId] || { coins: 0, gamesPlayed: 0, gamesWon: 0 };
                await sock.sendMessage(from, { text: 
                    `💰 *${targetName}*\n` +
                    `💎 Coin: ${formatNumber(targetUser.coins)} 🪙\n` +
                    `🎮 Games: ${targetUser.gamesPlayed} | 🏆 Menang: ${targetUser.gamesWon}`
                });
            }
            
            // ==================== LEADERBOARD ====================
            else if (cmd === 'lb') {
                const users = Object.values(db.users).sort((a,b) => b.coins - a.coins).slice(0,10);
                if (users.length === 0) return await sock.sendMessage(from, { text: '❌ Belum ada data' });
                let message = `🏆 *TOP 10 LEADERBOARD*\n\n`;
                for (let i=0; i<users.length; i++) {
                    message += `${i+1}. *${users[i].username}* - ${formatNumber(users[i].coins)} 🪙\n`;
                }
                await sock.sendMessage(from, { text: message });
            }
            
            // ==================== SPIN ====================
            else if (cmd === 'spin') {
                const dice = [rollDice(), rollDice(), rollDice()];
                const total = dice[0] + dice[1] + dice[2];
                await sock.sendMessage(from, { text: 
                    `🎲 *SPIN GRATIS*\n${pushName} melempar 3 dadu!\n\n🎲 ${dice[0]} | ${dice[1]} | ${dice[2]} = *${total}*\n\n*Spin ini gratis*`
                });
            }
            
            // ==================== DEPOSIT ====================
            else if (cmd === 'depo') {
                await sock.sendMessage(from, { text: 
                    `💰 *DEPOSIT COIN*\n📱 DANA/OVO/GOPAY: ${config.deposit.dana}\n💎 Rate: 10.000 = 1000 coin\n📋 Kirim bukti ke admin`
                });
            }
            
            // ==================== JACKPOT INFO ====================
            else if (cmd === 'jackpot') {
                await sock.sendMessage(from, { text: 
                    `💰 *JACKPOT POOL*\n💎 Total: ${formatNumber(db.jackpotPool)} coin\n\n` +
                    `🎯 *CARA MENANGKAN:*\n• Main slot/dadu/kartu\n• Dapatkan kombinasi langka\n• 1% chance dapat jackpot`
                });
            }
            
            // ==================== DEFAULT ====================
            else {
                await sock.sendMessage(from, { text: `❌ Command tidak dikenal! Ketik .menu untuk bantuan` });
            }
            
        } catch (err) {
            console.error('Error:', err);
        }
    });
}

// ==================== START ====================
startBot().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

console.log('🎮 DUEL RXV TEAMRXVVX WhatsApp Bot starting...');
console.log('📱 Bot akan meminta nomor WhatsApp untuk pairing\n');
