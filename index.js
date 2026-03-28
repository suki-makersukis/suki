// DUEL RXV TEAMRXVVX - WHATSAPP BOT (FINAL FIXED)
// Simpan sebagai index.js

// ==================== CRYPTO POLYFILL ====================
const crypto = require('crypto');
global.crypto = crypto;
globalThis.crypto = crypto;
console.log('✅ Crypto module loaded');

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// ==================== KONFIGURASI ====================
const config = {
    prefix: ".",
    botNumber: process.env.BOT_NUMBER || "6285726267699",
    botName: "DUEL RXV TEAMRXVVX",
    botEmoji: "🎮",
    coinEmoji: "🪙",
    version: "Valentine Edition - Final",
    
    deposit: {
        dana: "6283173495612",
        ovo: "6283173495612", 
        gopay: "6283173495612"
    },
    
    startingCoins: 0,
    gameExpireTime: 120000,
    maxRounds: 5,
    
    fee: {
        enabled: true,
        percentage: 5,
        minFee: 10,
        maxFee: 5000
    },
    
    jackpot: {
        minBet: 100,
        maxBet: 10000,
        progressive: true,
        baseAmount: 10000,
        contribution: 0.1
    }
};

// ==================== DATABASE ====================
let db = { 
    users: {}, 
    games: [],
    feeWallet: 0,
    feeHistory: [],
    giftCodes: [],
    jackpotPool: 10000,
    lastJackpotWinner: null,
    jackpotHistory: [],
    
    roles: {
        owners: [],
        sellers: [],
        banned: []
    },
    
    sellerSettings: {
        commission: 10,
        minTopup: 10000,
        maxTopup: 1000000,
        coinRate: 1000
    },
    
    pendingDeposits: [],
    transactionHistory: []
};

const DB_PATH = '/data/database.json';
const LOCAL_DB_PATH = './database.json';

// ==================== DATABASE FUNCTIONS WITH ERROR HANDLING ====================
function ensureDataDirectory() {
    try {
        // Buat direktori /data jika belum ada
        if (!fs.existsSync('/data')) {
            fs.mkdirSync('/data', { recursive: true });
            console.log('✅ Created /data directory');
        }
    } catch (err) {
        console.log('Cannot create /data, using local storage');
    }
}

function loadDatabase() {
    ensureDataDirectory();
    
    try {
        // Coba baca dari persistent volume dulu
        if (fs.existsSync(DB_PATH)) {
            const rawData = fs.readFileSync(DB_PATH);
            db = JSON.parse(rawData);
            console.log('✅ Database loaded from persistent storage');
            return true;
        } 
        // Coba baca dari local
        else if (fs.existsSync(LOCAL_DB_PATH)) {
            const rawData = fs.readFileSync(LOCAL_DB_PATH);
            db = JSON.parse(rawData);
            console.log('✅ Database loaded from local');
            // Copy ke persistent jika bisa
            try {
                fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
            } catch (err) {}
            return true;
        } 
        // Buat database baru
        else {
            db.roles.owners = [config.botNumber];
            db.roles.sellers = [];
            db.roles.banned = [];
            
            // Simpan ke kedua lokasi
            try {
                fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2));
                console.log('✅ Database created locally');
            } catch (err) {
                console.log('Error creating local database:', err.message);
            }
            
            try {
                fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
                console.log('✅ Database created in persistent storage');
            } catch (err) {
                console.log('Cannot write to persistent storage:', err.message);
            }
            
            return true;
        }
    } catch (err) {
        console.log('Database error:', err.message);
        
        // Fallback: gunakan memory-only database
        console.log('⚠️ Using memory-only database (data will be lost on restart)');
        db = { 
            users: {}, 
            games: [],
            feeWallet: 0,
            feeHistory: [],
            giftCodes: [],
            jackpotPool: 10000,
            lastJackpotWinner: null,
            jackpotHistory: [],
            roles: { owners: [config.botNumber], sellers: [], banned: [] },
            sellerSettings: { commission: 10, minTopup: 10000, maxTopup: 1000000, coinRate: 1000 },
            pendingDeposits: [],
            transactionHistory: []
        };
        return false;
    }
}

function saveDB() {
    try {
        // Simpan ke local
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2));
        
        // Coba simpan ke persistent
        try {
            fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        } catch (err) {
            // Persistent storage not available, ignore
        }
    } catch (err) {
        console.log('Save DB error:', err.message);
    }
}

// Load database
loadDatabase();

// ==================== HELPER FUNCTIONS ====================
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function cleanNumber(number) {
    return number.replace(/[^0-9]/g, '');
}

function generateId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function rollDice(sides = 6) {
    return Math.floor(Math.random() * sides) + 1;
}

function isOwner(number) {
    const cleanNum = cleanNumber(number);
    return db.roles.owners.includes(cleanNum);
}

function isSeller(number) {
    const cleanNum = cleanNumber(number);
    return db.roles.sellers.includes(cleanNum);
}

function isBanned(number) {
    const cleanNum = cleanNumber(number);
    return db.roles.banned.includes(cleanNum);
}

function getUser(userJid, pushName) {
    const userId = cleanNumber(userJid.split('@')[0]);
    if (isBanned(userId)) return null;
    
    if (!db.users[userId]) {
        db.users[userId] = {
            userId: userId,
            username: pushName || userId,
            coins: config.startingCoins,
            gamesPlayed: 0, gamesWon: 0, gamesLost: 0,
            gamesVsBot: 0, gamesVsPlayer: 0,
            totalBet: 0, totalWin: 0, totalLoss: 0,
            totalDeposit: 0, totalWithdraw: 0,
            totalCommission: 0,
            winStreak: 0, loseStreak: 0,
            totalFeePaid: 0,
            registerDate: new Date().toISOString()
        };
        saveDB();
    }
    return db.users[userId];
}

// ==================== GAME FUNCTIONS ====================
function playSlotHoki(bet) {
    const symbols = [
        { name: '🍒', multi: 2 },
        { name: '🍊', multi: 3 },
        { name: '🍋', multi: 5 },
        { name: '🍉', multi: 8 },
        { name: '⭐', multi: 15 },
        { name: '7️⃣', multi: 25 },
        { name: '💎', multi: 50 },
        { name: '👑', multi: 100 }
    ];
    
    const getSymbol = () => {
        const rand = Math.random();
        if (rand < 0.35) return symbols[0];
        if (rand < 0.55) return symbols[1];
        if (rand < 0.70) return symbols[2];
        if (rand < 0.82) return symbols[3];
        if (rand < 0.91) return symbols[4];
        if (rand < 0.96) return symbols[5];
        if (rand < 0.99) return symbols[6];
        return symbols[7];
    };
    
    const reels = [getSymbol(), getSymbol(), getSymbol()];
    let totalMultiplier = 0;
    
    if (reels[0].name === '👑' && reels[1].name === '👑' && reels[2].name === '👑') {
        totalMultiplier = 200;
    } else if (reels[0].name === '💎' && reels[1].name === '💎' && reels[2].name === '💎') {
        totalMultiplier = 100;
    } else if (reels[0].name === reels[1].name && reels[1].name === reels[2].name) {
        totalMultiplier = reels[0].multi * 3;
    } else if (reels[0].name === reels[1].name || reels[1].name === reels[2].name) {
        totalMultiplier = 3;
    } else if (reels.some(r => r.name === '7️⃣')) {
        totalMultiplier = 2;
    }
    
    const win = totalMultiplier > 0;
    const winAmount = win ? bet * totalMultiplier : 0;
    
    let jackpotHit = false;
    let jackpotAmount = 0;
    if (win && totalMultiplier >= 100 && Math.random() < 0.01) {
        jackpotHit = true;
        jackpotAmount = db.jackpotPool;
        db.jackpotPool = config.jackpot.baseAmount;
    }
    
    return { reels: reels.map(r => r.name), totalMultiplier, win, winAmount, jackpotHit, jackpotAmount };
}

function playDaduHoki(bet) {
    const dice = [rollDice(), rollDice(), rollDice()];
    const total = dice[0] + dice[1] + dice[2];
    let multiplier = 0;
    
    if (dice[0] === 6 && dice[1] === 6 && dice[2] === 6) {
        multiplier = 150;
    } else if (dice[0] === dice[1] && dice[1] === dice[2]) {
        multiplier = dice[0] === 1 ? 50 : dice[0] === 2 ? 45 : dice[0] === 3 ? 40 : dice[0] === 4 ? 35 : dice[0] === 5 ? 30 : 25;
    } else if (dice[0] === dice[1] || dice[1] === dice[2] || dice[0] === dice[2]) {
        multiplier = 5;
    } else if (total >= 17) {
        multiplier = 8;
    } else if (total <= 4) {
        multiplier = 8;
    } else if (total <= 6 || total >= 15) {
        multiplier = 4;
    }
    
    const win = multiplier > 0;
    const winAmount = win ? bet * multiplier : 0;
    return { dice, total, multiplier, win, winAmount };
}

function playKartuHoki(bet) {
    const cards = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const suits = ['♥️','♦️','♠️','♣️'];
    const draws = [];
    for (let i = 0; i < 3; i++) {
        const card = cards[Math.floor(Math.random() * cards.length)];
        const suit = suits[Math.floor(Math.random() * suits.length)];
        draws.push({ card, suit, value: cards.indexOf(card) + 2 });
    }
    
    const values = draws.map(d => d.value);
    const sameSuit = draws.every(d => d.suit === draws[0].suit);
    const hasRoyal = values.includes(14) && values.includes(13) && values.includes(12);
    
    let multiplier = 0;
    
    if (sameSuit && hasRoyal) {
        multiplier = 200;
    } else if (values[0] === values[1] && values[1] === values[2]) {
        multiplier = 50;
    } else if (sameSuit) {
        multiplier = 15;
    } else if (values[0] === values[1] || values[1] === values[2] || values[0] === values[2]) {
        multiplier = 5;
    }
    
    const win = multiplier > 0;
    const winAmount = win ? bet * multiplier : 0;
    return { draws, multiplier, win, winAmount };
}

// ==================== BOT START ====================
const activeGames = new Map();
const activePVH = new Map();

async function startBot() {
    console.log('\n🎮 DUEL RXV TEAMRXVVX WhatsApp Bot starting...');
    console.log(`📱 Bot Number: ${config.botNumber}`);
    console.log(`👑 Owner: ${db.roles.owners.join(', ')}`);
    console.log(`🛒 Seller: ${db.roles.sellers.length} seller`);
    console.log(`🚫 Banned: ${db.roles.banned.length} user\n`);
    
    const authDir = '/data/auth_info';
    const localAuthDir = './auth_info';
    
    // Buat direktori jika belum ada
    try {
        if (!fs.existsSync('/data')) fs.mkdirSync('/data', { recursive: true });
        if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
        if (!fs.existsSync(localAuthDir)) fs.mkdirSync(localAuthDir, { recursive: true });
        console.log('✅ Directories created');
    } catch (err) {
        console.log('Directory creation error:', err.message);
    }
    
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['DUEL RXV', 'Chrome', '1.0.0'],
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        connectTimeoutMs: 60000,
        version: [2, 3000, 1015901307]
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    // Connection handler
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log('\n✅ BOT BERHASIL TERHUBUNG!');
            console.log('📱 Bot siap digunakan! Kirim .menu ke WhatsApp\n');
            
            for (const owner of db.roles.owners) {
                try {
                    await sock.sendMessage(owner + '@s.whatsapp.net', 
                        `🎮 *${config.botName}* ONLINE!\n` +
                        `👑 Owner: ${db.roles.owners.length} orang\n` +
                        `🛒 Seller: ${db.roles.sellers.length} orang\n` +
                        `💰 Jackpot: ${formatNumber(db.jackpotPool)} coin\n\n` +
                        `📱 Ketik .menu untuk mulai!`
                    );
                } catch (err) {}
            }
            
        } else if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed, reconnecting:', shouldReconnect);
            if (shouldReconnect) {
                console.log('🔄 Restarting bot in 5 seconds...');
                setTimeout(() => {
                    process.exit(0);
                }, 5000);
            } else {
                console.log('Logged out, please restart');
                setTimeout(() => {
                    process.exit(0);
                }, 5000);
            }
        }
    });
    
    // PAIRING CODE dengan retry
    const phoneNumber = config.botNumber;
    console.log(`🔐 Meminta kode pairing untuk ${phoneNumber}...`);
    
    let retryCount = 0;
    const maxRetries = 5;
    let paired = false;
    
    const getPairingCode = async () => {
        try {
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n✅ KODE PAIRING: ${code}`);
            console.log('📱 CARA MENGGUNAKAN:');
            console.log('1. Buka WhatsApp di HP');
            console.log('2. Masuk ke Pengaturan > Perangkat Tertaut');
            console.log('3. Tap "Tautkan Perangkat"');
            console.log(`4. Masukkan kode: ${code}`);
            console.log('\n⏳ Menunggu koneksi...\n');
            paired = true;
            return true;
        } catch (err) {
            console.error(`❌ Gagal mendapatkan kode pairing (attempt ${retryCount + 1}/${maxRetries}):`, err.message);
            retryCount++;
            
            if (retryCount < maxRetries) {
                console.log(`🔄 Mencoba lagi dalam 5 detik...`);
                await new Promise(r => setTimeout(r, 5000));
                return getPairingCode();
            } else {
                console.log('\n❌ Gagal mendapatkan kode pairing setelah 5 kali percobaan!');
                console.log('📱 Pastikan:');
                console.log('1. Nomor WhatsApp benar: ' + phoneNumber);
                console.log('2. Nomor tersebut aktif dan terdaftar di WhatsApp');
                console.log('3. Koneksi internet stabil');
                console.log('4. WhatsApp tidak diblokir');
                console.log('\n🔄 Restarting bot in 10 seconds...');
                await new Promise(r => setTimeout(r, 10000));
                process.exit(0);
                return false;
            }
        }
    };
    
    await getPairingCode();
    
    // ==================== MESSAGE HANDLER ====================
    sock.ev.on('messages.upsert', async (msg) => {
        try {
            const m = msg.messages[0];
            if (!m.message || m.key.fromMe) return;
            if (m.key.remoteJid.includes('status')) return;
            
            const from = m.key.remoteJid;
            const sender = m.key.participant || from;
            const senderId = cleanNumber(sender.split('@')[0]);
            const pushName = m.pushName || senderId;
            
            if (isBanned(senderId)) {
                await sock.sendMessage(from, { text: '❌ Kamu telah dibanned dari bot ini!' });
                return;
            }
            
            const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
            if (!text.startsWith(config.prefix)) return;
            
            const args = text.slice(1).trim().split(/ +/);
            const cmd = args.shift().toLowerCase();
            
            // ==================== MENU ====================
            if (cmd === 'menu') {
                const isOwnerUser = isOwner(senderId);
                const isSellerUser = isSeller(senderId);
                
                let menu = `🎮 *${config.botName} - MENU UTAMA*\n\n` +
                    `💰 *JACKPOT:* ${formatNumber(db.jackpotPool)} 🪙\n` +
                    `👑 *Role:* ${isOwnerUser ? 'OWNER' : (isSellerUser ? 'SELLER' : 'MEMBER')}\n\n` +
                    
                    `🎰 *JUDOL HOKI-HOKIAN:*\n` +
                    `└ .slot [jumlah] - Slot Machine (Jackpot 200x)\n` +
                    `└ .dadu [jumlah] - Dadu Hoki (Jackpot 150x)\n` +
                    `└ .kartu [jumlah] - Kartu Hoki (Jackpot 200x)\n\n` +
                    
                    `💰 *ECONOMY:*\n` +
                    `└ .depo - Deposit\n` +
                    `└ .tf @nomor [jumlah] - Transfer\n` +
                    `└ .cc - Cek Coin\n` +
                    `└ .lb - Leaderboard\n` +
                    `└ .spin - Spin Gratis\n\n` +
                    
                    `🎁 *GIFT:*\n` +
                    `└ .tukar [kode] - Redeem Gift\n` +
                    `└ .jackpot - Info Jackpot\n\n` +
                    
                    `📱 *Deposit:* ${config.deposit.dana}`;
                
                await sock.sendMessage(from, { text: menu });
            }
            
            // ==================== HELP ====================
            else if (cmd === 'help') {
                await sock.sendMessage(from, { text: 
                    `📚 *PANDUAN GAME*\n\n` +
                    `🎰 *JUDOL HOKI-HOKIAN:*\n` +
                    `• .slot 1000 - Slot Machine (Jackpot 200x)\n` +
                    `• .dadu 1000 - Dadu Hoki (Jackpot 150x)\n` +
                    `• .kartu 1000 - Kartu Hoki (Jackpot 200x)\n\n` +
                    
                    `💎 *JACKPOT:*\n` +
                    `• 10% taruhan masuk jackpot\n` +
                    `• Chance 1% dapat jackpot saat menang besar\n\n` +
                    
                    `💰 *DEPOSIT:* ${config.deposit.dana}\n` +
                    `💎 Rate: Rp 10.000 = 1000 coin`
                });
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
                    `💰 *DEPOSIT COIN*\n\n` +
                    `📱 DANA: ${config.deposit.dana}\n` +
                    `📱 OVO: ${config.deposit.ovo}\n` +
                    `📱 GOPAY: ${config.deposit.gopay}\n\n` +
                    `💎 Rate: Rp 10.000 = 1000 coin\n` +
                    `📋 Kirim bukti ke admin`
                });
            }
            
            // ==================== TRANSFER ====================
            else if (cmd === 'tf') {
                if (args.length < 2) return await sock.sendMessage(from, { text: '❌ Gunakan: `.tf @nomor jumlah`' });
                const targetMention = args[0].replace('@', '');
                const targetId = cleanNumber(targetMention);
                const amount = parseInt(args[1]);
                if (!targetId || targetId.length < 10) return await sock.sendMessage(from, { text: '❌ Nomor tidak valid!' });
                if (targetId === senderId) return await sock.sendMessage(from, { text: '❌ Tidak bisa transfer ke diri sendiri!' });
                if (isNaN(amount) || amount <= 0) return await sock.sendMessage(from, { text: '❌ Jumlah tidak valid!' });
                
                const userData = db.users[senderId];
                if (!userData || userData.coins < amount) return await sock.sendMessage(from, { text: `❌ Coin tidak cukup!` });
                
                const receiver = db.users[targetId] || { userId: targetId, username: targetId, coins: 0 };
                db.users[targetId] = receiver;
                userData.coins -= amount;
                receiver.coins += amount;
                saveDB();
                await sock.sendMessage(from, { text: `💸 *TRANSFER*\n${pushName} → @${targetId}\n💰 ${formatNumber(amount)} coin` });
            }
            
            // ==================== REDEEM GIFT ====================
            else if (cmd === 'tukar') {
                if (!args[0]) return await sock.sendMessage(from, { text: '❌ Gunakan: `.tukar KODE`' });
                const code = args[0].toUpperCase();
                const gift = db.giftCodes.find(g => g.code === code && !g.used);
                if (!gift) return await sock.sendMessage(from, { text: '❌ Kode tidak valid!' });
                
                const userData = db.users[senderId];
                if (!userData) return await sock.sendMessage(from, { text: '❌ User tidak ditemukan!' });
                
                userData.coins += gift.coins;
                gift.used = true;
                gift.usedBy = senderId;
                gift.usedByUsername = pushName;
                gift.usedAt = new Date().toISOString();
                saveDB();
                await sock.sendMessage(from, { text: `🎁 *REDEEM*\nKode: ${code}\n💰 +${formatNumber(gift.coins)} coin` });
            }
            
            // ==================== JACKPOT ====================
            else if (cmd === 'jackpot') {
                await sock.sendMessage(from, { text: 
                    `💰 *JACKPOT POOL*\n💎 Total: ${formatNumber(db.jackpotPool)} coin\n\n` +
                    `🎯 *CARA MENANGKAN:*\n• Main slot/dadu/kartu\n• Dapatkan kombinasi langka\n• 1% chance dapat jackpot`
                });
            }
            
            // ==================== SLOT GAME ====================
            else if (cmd === 'slot') {
                const bet = parseInt(args[0]);
                if (isNaN(bet) || bet <= 0) return await sock.sendMessage(from, { text: '❌ Gunakan: `.slot 1000`' });
                
                const userData = db.users[senderId];
                if (!userData) return await sock.sendMessage(from, { text: '❌ User tidak ditemukan!' });
                if (userData.coins < bet) return await sock.sendMessage(from, { text: `❌ Coin tidak cukup!` });
                
                userData.coins -= bet;
                const result = playSlotHoki(bet);
                let winAmount = result.winAmount;
                let jackpotAmount = 0;
                
                if (result.jackpotHit) {
                    winAmount += result.jackpotAmount;
                    jackpotAmount = result.jackpotAmount;
                    db.lastJackpotWinner = { userId: senderId, username: pushName, amount: jackpotAmount, time: new Date().toISOString() };
                    db.jackpotHistory.push({ userId: senderId, username: pushName, amount: jackpotAmount, time: new Date().toISOString() });
                    if (db.jackpotHistory.length > 10) db.jackpotHistory.shift();
                }
                
                userData.coins += winAmount;
                if (result.win || result.jackpotHit) {
                    userData.gamesWon++;
                } else {
                    userData.gamesLost++;
                }
                userData.gamesPlayed++;
                db.jackpotPool += Math.floor(bet * config.jackpot.contribution);
                saveDB();
                
                await sock.sendMessage(from, { text: 
                    `🎰 *SLOT HOKI*\n` +
                    `┌─────┬─────┬─────┐\n` +
                    `│  ${result.reels[0]}  │  ${result.reels[1]}  │  ${result.reels[2]}  │\n` +
                    `└─────┴─────┴─────┘\n\n` +
                    `💰 Taruhan: ${formatNumber(bet)} coin\n` +
                    (result.win ? `🎁 MENANG: ${formatNumber(winAmount)} coin (${result.totalMultiplier}x)\n` : `😢 KALAH: -${formatNumber(bet)} coin\n`) +
                    (jackpotAmount > 0 ? `👑 JACKPOT: +${formatNumber(jackpotAmount)} coin 👑\n` : '') +
                    `💳 Saldo: ${formatNumber(userData.coins)} coin`
                });
            }
            
            // ==================== DADU GAME ====================
            else if (cmd === 'dadu') {
                const bet = parseInt(args[0]);
                if (isNaN(bet) || bet <= 0) return await sock.sendMessage(from, { text: '❌ Gunakan: `.dadu 1000`' });
                
                const userData = db.users[senderId];
                if (!userData) return await sock.sendMessage(from, { text: '❌ User tidak ditemukan!' });
                if (userData.coins < bet) return await sock.sendMessage(from, { text: `❌ Coin tidak cukup!` });
                
                userData.coins -= bet;
                const result = playDaduHoki(bet);
                userData.coins += result.winAmount;
                
                if (result.win) {
                    userData.gamesWon++;
                } else {
                    userData.gamesLost++;
                }
                userData.gamesPlayed++;
                db.jackpotPool += Math.floor(bet * config.jackpot.contribution);
                saveDB();
                
                await sock.sendMessage(from, { text: 
                    `🎲 *DADU HOKI*\n` +
                    `┌─────┬─────┬─────┐\n` +
                    `│  ${result.dice[0]}  │  ${result.dice[1]}  │  ${result.dice[2]}  │\n` +
                    `└─────┴─────┴─────┘\n` +
                    `📊 Total: ${result.total}\n\n` +
                    `💰 Taruhan: ${formatNumber(bet)} coin\n` +
                    (result.win ? `🎁 MENANG: ${formatNumber(result.winAmount)} coin (${result.multiplier}x)\n` : `😢 KALAH: -${formatNumber(bet)} coin\n`) +
                    `💳 Saldo: ${formatNumber(userData.coins)} coin`
                });
            }
            
            // ==================== KARTU GAME ====================
            else if (cmd === 'kartu') {
                const bet = parseInt(args[0]);
                if (isNaN(bet) || bet <= 0) return await sock.sendMessage(from, { text: '❌ Gunakan: `.kartu 1000`' });
                
                const userData = db.users[senderId];
                if (!userData) return await sock.sendMessage(from, { text: '❌ User tidak ditemukan!' });
                if (userData.coins < bet) return await sock.sendMessage(from, { text: `❌ Coin tidak cukup!` });
                
                userData.coins -= bet;
                const result = playKartuHoki(bet);
                userData.coins += result.winAmount;
                
                if (result.win) {
                    userData.gamesWon++;
                } else {
                    userData.gamesLost++;
                }
                userData.gamesPlayed++;
                db.jackpotPool += Math.floor(bet * config.jackpot.contribution);
                saveDB();
                
                const cardsText = result.draws.map(d => `${d.suit}${d.card}`).join(' | ');
                await sock.sendMessage(from, { text: 
                    `🎴 *KARTU HOKI*\n` +
                    `🃏 ${cardsText}\n\n` +
                    `💰 Taruhan: ${formatNumber(bet)} coin\n` +
                    (result.win ? `🎁 MENANG: ${formatNumber(result.winAmount)} coin (${result.multiplier}x)\n` : `😢 KALAH: -${formatNumber(bet)} coin\n`) +
                    `💳 Saldo: ${formatNumber(userData.coins)} coin`
                });
            }
            
            // ==================== ADMIN COMMANDS ====================
            if (isOwner(senderId)) {
                // ADD OWNER
                if (cmd === 'addowner') {
                    if (args.length < 1) return await sock.sendMessage(from, { text: '❌ Gunakan: `.addowner [nomor]`' });
                    const newOwner = cleanNumber(args[0]);
                    if (!db.roles.owners.includes(newOwner)) {
                        db.roles.owners.push(newOwner);
                        saveDB();
                        await sock.sendMessage(from, { text: `✅ Owner baru: @${newOwner}` });
                        try {
                            await sock.sendMessage(newOwner + '@s.whatsapp.net', { text: `🎉 Kamu ditambahkan sebagai OWNER ${config.botName}!` });
                        } catch (err) {}
                    } else {
                        await sock.sendMessage(from, { text: `❌ ${newOwner} sudah menjadi owner!` });
                    }
                }
                
                // ADD SELLER
                else if (cmd === 'addseller') {
                    if (args.length < 1) return await sock.sendMessage(from, { text: '❌ Gunakan: `.addseller [nomor]`' });
                    const newSeller = cleanNumber(args[0]);
                    if (!db.roles.sellers.includes(newSeller)) {
                        db.roles.sellers.push(newSeller);
                        saveDB();
                        await sock.sendMessage(from, { text: `✅ Seller baru: @${newSeller}` });
                    } else {
                        await sock.sendMessage(from, { text: `❌ ${newSeller} sudah menjadi seller!` });
                    }
                }
                
                // ADD COIN
                else if (cmd === 'addcoin') {
                    if (args.length < 2) return await sock.sendMessage(from, { text: '❌ Gunakan: `.addcoin @nomor jumlah`' });
                    const targetMention = args[0].replace('@', '');
                    const targetId = cleanNumber(targetMention);
                    const amount = parseInt(args[1]);
                    if (isNaN(amount) || amount <= 0) return await sock.sendMessage(from, { text: '❌ Jumlah tidak valid!' });
                    
                    const targetUser = db.users[targetId] || { userId: targetId, username: targetId, coins: 0 };
                    db.users[targetId] = targetUser;
                    targetUser.coins += amount;
                    saveDB();
                    await sock.sendMessage(from, { text: `✅ ADD COIN\n@${targetId} +${formatNumber(amount)} coin` });
                }
                
                // CREATE GIFT
                else if (cmd === 'creategift') {
                    if (args.length < 1) return await sock.sendMessage(from, { text: '❌ Gunakan: `.creategift jumlah [kode] [hari]`' });
                    const amount = parseInt(args[0]);
                    if (isNaN(amount) || amount <= 0) return await sock.sendMessage(from, { text: '❌ Jumlah tidak valid!' });
                    let code = args[1]?.toUpperCase() || generateId();
                    let days = parseInt(args[2]) || 30;
                    if (db.giftCodes.some(g => g.code === code)) return await sock.sendMessage(from, { text: `❌ Kode ${code} sudah ada!` });
                    
                    db.giftCodes.push({
                        code, coins: amount, used: false,
                        createdBy: senderId, createdByUsername: pushName,
                        createdAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
                    });
                    saveDB();
                    await sock.sendMessage(from, { text: `✅ GIFT CODE\nKode: ${code}\n💰 ${formatNumber(amount)} coin\n📅 ${days} hari\n.tukar ${code}` });
                }
            }
            
        } catch (err) {
            console.error('Error in message handler:', err);
        }
    });
}

// ==================== START ====================
startBot().catch(err => {
    console.error('Fatal error:', err);
    console.log('🔄 Restarting in 10 seconds...');
    setTimeout(() => process.exit(0), 10000);
});

console.log('🎮 DUEL RXV TEAMRXVVX WhatsApp Bot starting...');
