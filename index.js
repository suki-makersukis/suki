// DUEL RXV TEAMRXVVX - WHATSAPP BOT (AUTO RECONNECT)
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
    version: "Final",
    
    deposit: {
        dana: "6283173495612",
        ovo: "6283173495612", 
        gopay: "6283173495612"
    },
    
    startingCoins: 0,
    fee: { enabled: true, percentage: 5, minFee: 10, maxFee: 5000 },
    jackpot: { contribution: 0.1, baseAmount: 10000 }
};

// ==================== DATABASE ====================
let db = { 
    users: {}, 
    games: [],
    feeWallet: 0,
    giftCodes: [],
    jackpotPool: 10000,
    roles: { owners: [], sellers: [], banned: [] }
};

const DB_PATH = '/data/database.json';
const LOCAL_DB_PATH = './database.json';

function ensureDirectories() {
    try {
        if (!fs.existsSync('/data')) fs.mkdirSync('/data', { recursive: true });
    } catch (err) {}
    try {
        if (!fs.existsSync('./auth_info')) fs.mkdirSync('./auth_info', { recursive: true });
    } catch (err) {}
}

function loadDatabase() {
    ensureDirectories();
    
    try {
        if (fs.existsSync(DB_PATH)) {
            db = JSON.parse(fs.readFileSync(DB_PATH));
            console.log('✅ Database loaded');
        } else if (fs.existsSync(LOCAL_DB_PATH)) {
            db = JSON.parse(fs.readFileSync(LOCAL_DB_PATH));
            fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
            console.log('✅ Database loaded from local');
        } else {
            db.roles.owners = [config.botNumber];
            fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2));
            fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
            console.log('✅ Database created');
        }
    } catch (err) {
        console.log('Database error:', err.message);
        db.roles.owners = [config.botNumber];
    }
}

function saveDB() {
    try {
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2));
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
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

function generateId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function rollDice() {
    return Math.floor(Math.random() * 6) + 1;
}

function isOwner(number) {
    return db.roles.owners.includes(cleanNumber(number));
}

function isBanned(number) {
    return db.roles.banned.includes(cleanNumber(number));
}

function getUser(userJid, pushName) {
    const userId = cleanNumber(userJid.split('@')[0]);
    if (isBanned(userId)) return null;
    
    if (!db.users[userId]) {
        db.users[userId] = {
            userId, username: pushName || userId,
            coins: config.startingCoins,
            gamesPlayed: 0, gamesWon: 0, gamesLost: 0
        };
        saveDB();
    }
    return db.users[userId];
}

// ==================== GAME FUNCTIONS ====================
function playSlotHoki(bet) {
    const symbols = ['🍒', '🍊', '🍋', '🍉', '⭐', '7️⃣', '💎', '👑'];
    const reels = [symbols[Math.floor(Math.random() * symbols.length)], 
                    symbols[Math.floor(Math.random() * symbols.length)], 
                    symbols[Math.floor(Math.random() * symbols.length)]];
    let multiplier = 0;
    
    if (reels[0] === '👑' && reels[1] === '👑' && reels[2] === '👑') multiplier = 200;
    else if (reels[0] === '💎' && reels[1] === '💎' && reels[2] === '💎') multiplier = 100;
    else if (reels[0] === reels[1] && reels[1] === reels[2]) multiplier = 20;
    else if (reels[0] === reels[1] || reels[1] === reels[2]) multiplier = 3;
    else if (reels.includes('7️⃣')) multiplier = 2;
    
    const win = multiplier > 0;
    const winAmount = win ? bet * multiplier : 0;
    return { reels, multiplier, win, winAmount };
}

function playDaduHoki(bet) {
    const dice = [rollDice(), rollDice(), rollDice()];
    const total = dice[0] + dice[1] + dice[2];
    let multiplier = 0;
    
    if (dice[0] === 6 && dice[1] === 6 && dice[2] === 6) multiplier = 150;
    else if (dice[0] === dice[1] && dice[1] === dice[2]) multiplier = 50;
    else if (dice[0] === dice[1] || dice[1] === dice[2] || dice[0] === dice[2]) multiplier = 5;
    else if (total >= 17) multiplier = 8;
    else if (total <= 4) multiplier = 8;
    else if (total <= 6 || total >= 15) multiplier = 4;
    
    const win = multiplier > 0;
    const winAmount = win ? bet * multiplier : 0;
    return { dice, total, multiplier, win, winAmount };
}

function playKartuHoki(bet) {
    const cards = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const suits = ['♥️','♦️','♠️','♣️'];
    const draws = [];
    for (let i = 0; i < 3; i++) {
        draws.push({ card: cards[Math.floor(Math.random() * cards.length)], 
                     suit: suits[Math.floor(Math.random() * suits.length)] });
    }
    let multiplier = 0;
    
    const sameSuit = draws.every(d => d.suit === draws[0].suit);
    const sameCard = draws.every(d => d.card === draws[0].card);
    
    if (sameCard) multiplier = 100;
    else if (sameSuit && draws.some(d => d.card === 'A') && draws.some(d => d.card === 'K') && draws.some(d => d.card === 'Q')) multiplier = 200;
    else if (sameSuit) multiplier = 15;
    else if (draws[0].card === draws[1].card || draws[1].card === draws[2].card || draws[0].card === draws[2].card) multiplier = 5;
    
    const win = multiplier > 0;
    const winAmount = win ? bet * multiplier : 0;
    return { draws, multiplier, win, winAmount };
}

// ==================== BOT START WITH AUTO RECONNECT ====================
let sock = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 10;

async function startBot() {
    console.log('\n🎮 DUEL RXV TEAMRXVVX WhatsApp Bot starting...');
    console.log(`📱 Bot Number: ${config.botNumber}`);
    console.log(`👑 Owner: ${db.roles.owners.join(', ')}\n`);
    
    ensureDirectories();
    
    const authDir = '/data/auth_info';
    
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    
    sock = makeWASocket({
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
    
    // Connection handler with auto reconnect
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log('\n✅ BOT BERHASIL TERHUBUNG!');
            console.log('📱 Kirim .menu ke WhatsApp untuk mulai\n');
            reconnectAttempts = 0;
            
            // Notify owner
            for (const owner of db.roles.owners) {
                try {
                    await sock.sendMessage(owner + '@s.whatsapp.net', 
                        `🎮 *${config.botName}* ONLINE!\n💰 Jackpot: ${formatNumber(db.jackpotPool)} coin\n📱 Ketik .menu untuk mulai!`
                    );
                } catch (err) {}
            }
            
        } else if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            
            if (shouldReconnect && reconnectAttempts < MAX_RECONNECT) {
                reconnectAttempts++;
                console.log(`🔄 Connection closed. Reconnecting in ${reconnectAttempts * 5} seconds... (Attempt ${reconnectAttempts}/${MAX_RECONNECT})`);
                setTimeout(() => {
                    startBot();
                }, reconnectAttempts * 5000);
            } else if (reconnectAttempts >= MAX_RECONNECT) {
                console.log('❌ Max reconnection attempts reached. Please restart manually.');
            } else {
                console.log('❌ Logged out. Please restart.');
            }
        }
    });
    
    // Request pairing code with retry
    const requestPairing = async (retry = 0) => {
        try {
            console.log(`🔐 Requesting pairing code for ${config.botNumber}...`);
            const code = await sock.requestPairingCode(config.botNumber);
            console.log(`\n✅ KODE PAIRING: ${code}`);
            console.log('📱 CARA: Pengaturan > Perangkat Tertaut > Tautkan Perangkat');
            console.log(`📱 Masukkan kode: ${code}\n`);
            return true;
        } catch (err) {
            console.log(`❌ Pairing failed (attempt ${retry + 1}/5): ${err.message}`);
            if (retry < 4) {
                console.log(`🔄 Retrying in 10 seconds...`);
                await new Promise(r => setTimeout(r, 10000));
                return requestPairing(retry + 1);
            }
            console.log('❌ Failed to get pairing code after 5 attempts.');
            return false;
        }
    };
    
    await requestPairing();
    
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
                await sock.sendMessage(from, { text: '❌ Kamu telah dibanned!' });
                return;
            }
            
            const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
            if (!text.startsWith(config.prefix)) return;
            
            const args = text.slice(1).trim().split(/ +/);
            const cmd = args.shift().toLowerCase();
            
            // ==================== MENU ====================
            if (cmd === 'menu') {
                const menu = 
                    `🎮 *${config.botName} - MENU*\n\n` +
                    `💰 *JACKPOT:* ${formatNumber(db.jackpotPool)} 🪙\n` +
                    `👑 *Role:* ${isOwner(senderId) ? 'OWNER' : 'MEMBER'}\n\n` +
                    
                    `🎰 *JUDOL HOKI:*\n` +
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
                    `└ .jackpot - Info Jackpot\n\n` +
                    
                    `📱 *Deposit:* ${config.deposit.dana}`;
                
                await sock.sendMessage(from, { text: menu });
            }
            
            // ==================== HELP ====================
            else if (cmd === 'help') {
                await sock.sendMessage(from, { text: 
                    `📚 *PANDUAN*\n\n` +
                    `🎰 *JUDOL:*\n` +
                    `.slot 1000 - Slot Machine\n` +
                    `.dadu 1000 - Dadu Hoki\n` +
                    `.kartu 1000 - Kartu Hoki\n\n` +
                    `💰 *DEPOSIT:* ${config.deposit.dana}\n` +
                    `💎 Rate: 10.000 = 1000 coin`
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
                const u = db.users[targetId] || { coins: 0, gamesPlayed: 0, gamesWon: 0 };
                await sock.sendMessage(from, { text: 
                    `💰 *${targetName}*\n💎 Coin: ${formatNumber(u.coins)} 🪙\n🎮 Games: ${u.gamesPlayed} | 🏆 Menang: ${u.gamesWon}`
                });
            }
            
            // ==================== LEADERBOARD ====================
            else if (cmd === 'lb') {
                const users = Object.values(db.users).sort((a,b) => b.coins - a.coins).slice(0,10);
                if (users.length === 0) return await sock.sendMessage(from, { text: '❌ Belum ada data' });
                let message = `🏆 *TOP 10*\n\n`;
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
                    `🎲 *SPIN GRATIS*\n${pushName}: ${dice[0]} | ${dice[1]} | ${dice[2]} = *${total}*\n*Gratis!*`
                });
            }
            
            // ==================== DEPOSIT ====================
            else if (cmd === 'depo') {
                await sock.sendMessage(from, { text: 
                    `💰 *DEPOSIT*\n📱 DANA/OVO/GOPAY: ${config.deposit.dana}\n💎 Rate: 10.000 = 1000 coin`
                });
            }
            
            // ==================== TRANSFER ====================
            else if (cmd === 'tf') {
                if (args.length < 2) return await sock.sendMessage(from, { text: '❌ .tf @nomor jumlah' });
                const targetId = cleanNumber(args[0].replace('@', ''));
                const amount = parseInt(args[1]);
                if (!targetId || targetId.length < 10) return await sock.sendMessage(from, { text: '❌ Nomor tidak valid!' });
                if (targetId === senderId) return await sock.sendMessage(from, { text: '❌ Transfer ke diri sendiri?' });
                if (isNaN(amount) || amount <= 0) return await sock.sendMessage(from, { text: '❌ Jumlah tidak valid!' });
                
                const u = db.users[senderId];
                if (!u || u.coins < amount) return await sock.sendMessage(from, { text: '❌ Coin tidak cukup!' });
                
                const r = db.users[targetId] || { userId: targetId, username: targetId, coins: 0 };
                db.users[targetId] = r;
                u.coins -= amount;
                r.coins += amount;
                saveDB();
                await sock.sendMessage(from, { text: `💸 *TRANSFER*\n${pushName} → @${targetId}\n💰 ${formatNumber(amount)} coin` });
            }
            
            // ==================== REDEEM ====================
            else if (cmd === 'tukar') {
                if (!args[0]) return await sock.sendMessage(from, { text: '❌ .tukar KODE' });
                const code = args[0].toUpperCase();
                const gift = db.giftCodes.find(g => g.code === code && !g.used);
                if (!gift) return await sock.sendMessage(from, { text: '❌ Kode tidak valid!' });
                
                const u = db.users[senderId];
                if (!u) return await sock.sendMessage(from, { text: '❌ User tidak ditemukan!' });
                
                u.coins += gift.coins;
                gift.used = true;
                gift.usedBy = senderId;
                saveDB();
                await sock.sendMessage(from, { text: `🎁 *REDEEM*\nKode: ${code}\n💰 +${formatNumber(gift.coins)} coin` });
            }
            
            // ==================== JACKPOT ====================
            else if (cmd === 'jackpot') {
                await sock.sendMessage(from, { text: `💰 *JACKPOT*\n💎 Total: ${formatNumber(db.jackpotPool)} coin` });
            }
            
            // ==================== SLOT ====================
            else if (cmd === 'slot') {
                const bet = parseInt(args[0]);
                if (isNaN(bet) || bet <= 0) return await sock.sendMessage(from, { text: '❌ .slot 1000' });
                
                const u = db.users[senderId];
                if (!u || u.coins < bet) return await sock.sendMessage(from, { text: '❌ Coin tidak cukup!' });
                
                u.coins -= bet;
                const result = playSlotHoki(bet);
                u.coins += result.winAmount;
                if (result.win) u.gamesWon++;
                else u.gamesLost++;
                u.gamesPlayed++;
                db.jackpotPool += Math.floor(bet * config.jackpot.contribution);
                saveDB();
                
                await sock.sendMessage(from, { text: 
                    `🎰 *SLOT*\n${result.reels.join(' | ')}\n` +
                    (result.win ? `🎁 MENANG: ${formatNumber(result.winAmount)} (${result.multiplier}x)\n` : `😢 KALAH\n`) +
                    `💳 Saldo: ${formatNumber(u.coins)}`
                });
            }
            
            // ==================== DADU ====================
            else if (cmd === 'dadu') {
                const bet = parseInt(args[0]);
                if (isNaN(bet) || bet <= 0) return await sock.sendMessage(from, { text: '❌ .dadu 1000' });
                
                const u = db.users[senderId];
                if (!u || u.coins < bet) return await sock.sendMessage(from, { text: '❌ Coin tidak cukup!' });
                
                u.coins -= bet;
                const result = playDaduHoki(bet);
                u.coins += result.winAmount;
                if (result.win) u.gamesWon++;
                else u.gamesLost++;
                u.gamesPlayed++;
                db.jackpotPool += Math.floor(bet * config.jackpot.contribution);
                saveDB();
                
                await sock.sendMessage(from, { text: 
                    `🎲 *DADU*\n${result.dice[0]} | ${result.dice[1]} | ${result.dice[2]} = ${result.total}\n` +
                    (result.win ? `🎁 MENANG: ${formatNumber(result.winAmount)} (${result.multiplier}x)\n` : `😢 KALAH\n`) +
                    `💳 Saldo: ${formatNumber(u.coins)}`
                });
            }
            
            // ==================== KARTU ====================
            else if (cmd === 'kartu') {
                const bet = parseInt(args[0]);
                if (isNaN(bet) || bet <= 0) return await sock.sendMessage(from, { text: '❌ .kartu 1000' });
                
                const u = db.users[senderId];
                if (!u || u.coins < bet) return await sock.sendMessage(from, { text: '❌ Coin tidak cukup!' });
                
                u.coins -= bet;
                const result = playKartuHoki(bet);
                u.coins += result.winAmount;
                if (result.win) u.gamesWon++;
                else u.gamesLost++;
                u.gamesPlayed++;
                db.jackpotPool += Math.floor(bet * config.jackpot.contribution);
                saveDB();
                
                const cards = result.draws.map(d => `${d.suit}${d.card}`).join(' | ');
                await sock.sendMessage(from, { text: 
                    `🎴 *KARTU*\n${cards}\n` +
                    (result.win ? `🎁 MENANG: ${formatNumber(result.winAmount)} (${result.multiplier}x)\n` : `😢 KALAH\n`) +
                    `💳 Saldo: ${formatNumber(u.coins)}`
                });
            }
            
            // ==================== ADMIN ====================
            if (isOwner(senderId)) {
                if (cmd === 'addcoin') {
                    if (args.length < 2) return;
                    const targetId = cleanNumber(args[0].replace('@', ''));
                    const amount = parseInt(args[1]);
                    const tu = db.users[targetId] || { userId: targetId, username: targetId, coins: 0 };
                    db.users[targetId] = tu;
                    tu.coins += amount;
                    saveDB();
                    await sock.sendMessage(from, { text: `✅ ADD COIN\n@${targetId} +${formatNumber(amount)} coin` });
                }
                
                if (cmd === 'addowner') {
                    if (args.length < 1) return;
                    const newOwner = cleanNumber(args[0]);
                    if (!db.roles.owners.includes(newOwner)) {
                        db.roles.owners.push(newOwner);
                        saveDB();
                        await sock.sendMessage(from, { text: `✅ Owner baru: @${newOwner}` });
                    }
                }
                
                if (cmd === 'creategift') {
                    if (args.length < 1) return;
                    const amount = parseInt(args[0]);
                    const code = args[1]?.toUpperCase() || generateId();
                    db.giftCodes.push({ code, coins: amount, used: false, createdBy: senderId });
                    saveDB();
                    await sock.sendMessage(from, { text: `✅ GIFT: ${code} - ${formatNumber(amount)} coin` });
                }
            }
            
        } catch (err) {
            console.error('Error:', err);
        }
    });
}

// ==================== START ====================
startBot().catch(err => {
    console.error('Fatal error:', err);
    setTimeout(() => process.exit(0), 5000);
});

console.log('🎮 DUEL RXV TEAMRXVVX WhatsApp Bot starting...');
