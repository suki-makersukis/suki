// DUEL RXV TEAMRXVVX - BOT WHATSAPP LENGKAP (PVP + PVH + JUDOL)
// Simpan sebagai index.js

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// ==================== KONFIGURASI ====================
const config = {
    prefix: ".",
    ownerNumber: process.env.OWNER_NUMBER || "6283173495612",
    botName: "DUEL RXV TEAMRXVVX",
    botEmoji: "🎮",
    coinEmoji: "🪙",
    version: "Valentine Edition - Complete Gaming",
    
    deposit: {
        dana: "6283173495612",
        ovo: "6283173495612", 
        gopay: "6283173495612"
    },
    
    startingCoins: 0,
    gameExpireTime: 120000, // 2 menit
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
    jackpotHistory: []
};

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

function generateId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function rollDice(sides = 6) {
    return Math.floor(Math.random() * sides) + 1;
}

function getUser(userJid, pushName) {
    const userId = userJid.split('@')[0];
    if (!db.users[userId]) {
        db.users[userId] = {
            userId, username: pushName || userId,
            coins: config.startingCoins,
            gamesPlayed: 0, gamesWon: 0, gamesLost: 0,
            gamesVsBot: 0, gamesVsPlayer: 0,
            totalBet: 0, totalWin: 0, totalLoss: 0,
            winStreak: 0, loseStreak: 0,
            totalFeePaid: 0,
            registerDate: new Date().toISOString()
        };
        saveDB();
    }
    return db.users[userId];
}

function updateJackpot(bet) {
    const contribution = Math.floor(bet * config.jackpot.contribution);
    db.jackpotPool += contribution;
    saveDB();
    return db.jackpotPool;
}

// ==================== GAME LOGIC PVP & PVH ====================

// REME (Adu angka 1-1000)
function playReme(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 1000) + 1;
        const p2 = Math.floor(Math.random() * 1000) + 1;
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        results.push(`Ronde ${r}: ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// QEME (Tebak angka 1-50)
function playQeme(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const secret = Math.floor(Math.random() * 50) + 1;
        const p1 = Math.floor(Math.random() * 50) + 1;
        const p2 = Math.floor(Math.random() * 50) + 1;
        const diff1 = Math.abs(secret - p1);
        const diff2 = Math.abs(secret - p2);
        if (diff1 < diff2) playerWins++;
        else if (diff2 < diff1) opponentWins++;
        results.push(`Ronde ${r}: Angka=${secret} | ${p1} vs ${p2} (selisih ${diff1}/${diff2}) ${diff1 < diff2 ? '✅' : diff2 < diff1 ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// QQ (Kartu 1-13)
function playQQ(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 13) + 1;
        const p2 = Math.floor(Math.random() * 13) + 1;
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        results.push(`Ronde ${r}: ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// CSN (Casino random 1-100)
function playCSN(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 100) + 1;
        const p2 = Math.floor(Math.random() * 100) + 1;
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        results.push(`Ronde ${r}: ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// BTK (Battle 1-50)
function playBTK(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 50) + 1;
        const p2 = Math.floor(Math.random() * 50) + 1;
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        results.push(`Ronde ${r}: ⚔️ ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// DIRT (Dirt seed 1-100)
function playDirt(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 100) + 1;
        const p2 = Math.floor(Math.random() * 100) + 1;
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        results.push(`Ronde ${r}: 🌱 ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// BC (Baccarat 0-9)
function playBC(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 10);
        const p2 = Math.floor(Math.random() * 10);
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        results.push(`Ronde ${r}: 🎰 ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// BJ (Blackjack 1-21)
function playBJ(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 21) + 1;
        const p2 = Math.floor(Math.random() * 21) + 1;
        if (p1 > 21 && p2 > 21) {}
        else if (p1 > 21) opponentWins++;
        else if (p2 > 21) playerWins++;
        else if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        results.push(`Ronde ${r}: 🃏 ${p1} vs ${p2}`);
    }
    return { playerWins, opponentWins, results };
}

// KB (Kecil/Besar 2 dadu)
function playKB(rounds, hostChoice) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const dice1 = rollDice();
        const dice2 = rollDice();
        const total = dice1 + dice2;
        const hasil = total <= 6 ? 'KECIL' : 'BESAR';
        const joinerChoice = hostChoice === 'KECIL' ? 'BESAR' : 'KECIL';
        if (hostChoice === hasil) playerWins++;
        else if (joinerChoice === hasil) opponentWins++;
        results.push(`Ronde ${r}: 🎲 ${dice1}+${dice2}=${total} (${hasil}) | Host:${hostChoice} vs Joiner:${joinerChoice} ${hostChoice === hasil ? '✅' : '❌'}`);
    }
    return { playerWins, opponentWins, results };
}

// DADU (Adu 2 dadu)
function playDadu(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const p1 = rollDice() + rollDice();
        const p2 = rollDice() + rollDice();
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        results.push(`Ronde ${r}: 🎲 ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// CARD (Adu kartu)
function playCard(rounds) {
    const cards = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const suits = ['♥️','♦️','♠️','♣️'];
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const p1Card = cards[Math.floor(Math.random() * cards.length)];
        const p1Suit = suits[Math.floor(Math.random() * suits.length)];
        const p1Value = cards.indexOf(p1Card) + 2;
        const p2Card = cards[Math.floor(Math.random() * cards.length)];
        const p2Suit = suits[Math.floor(Math.random() * suits.length)];
        const p2Value = cards.indexOf(p2Card) + 2;
        if (p1Value > p2Value) playerWins++;
        else if (p2Value > p1Value) opponentWins++;
        results.push(`Ronde ${r}: 🎴 ${p1Suit}${p1Card}(${p1Value}) vs ${p2Suit}${p2Card}(${p2Value}) ${p1Value > p2Value ? '✅' : p2Value > p1Value ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// FLIP (Coinflip 3x)
function playFlip(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        let playerScore = 0, opponentScore = 0;
        for (let f = 1; f <= 3; f++) {
            const flip = Math.random() < 0.5 ? 'KEPALA' : 'EKOR';
            const p1 = Math.random() < 0.5 ? 'KEPALA' : 'EKOR';
            const p2 = p1 === 'KEPALA' ? 'EKOR' : 'KEPALA';
            if (p1 === flip) playerScore++;
            else opponentScore++;
        }
        if (playerScore > opponentScore) playerWins++;
        else if (opponentScore > playerScore) opponentWins++;
        results.push(`Ronde ${r}: Player ${playerScore} vs Opponent ${opponentScore} ${playerScore > opponentScore ? '✅' : opponentScore > playerScore ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// ==================== GAME JUDOL HOKI-HOKIAN ====================

// SLOT MACHINE
function playSlotHoki(bet) {
    const symbols = [
        { name: '🍒', value: 1, multi: 2 },
        { name: '🍊', value: 2, multi: 3 },
        { name: '🍋', value: 3, multi: 5 },
        { name: '🍉', value: 4, multi: 8 },
        { name: '⭐', value: 5, multi: 15 },
        { name: '7️⃣', value: 6, multi: 25 },
        { name: '💎', value: 7, multi: 50 },
        { name: '👑', value: 8, multi: 100 }
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
    const reelsDisplay = reels.map(r => r.name);
    let totalMultiplier = 0;
    let winLines = [];
    
    if (reels[0].name === '👑' && reels[1].name === '👑' && reels[2].name === '👑') {
        totalMultiplier = 200;
        winLines = ['👑👑👑 JACKPOT ROYAL! 200x! 👑👑👑'];
    } else if (reels[0].name === '💎' && reels[1].name === '💎' && reels[2].name === '💎') {
        totalMultiplier = 100;
        winLines = ['💎💎💎 BIG WIN! 100x! 💎💎💎'];
    } else if (reels[0].name === reels[1].name && reels[1].name === reels[2].name) {
        totalMultiplier = reels[0].multi * 3;
        winLines = [`🎰 ${reels[0].name}${reels[0].name}${reels[0].name}! ${totalMultiplier}x!`];
    } else if (reels[0].name === reels[1].name || reels[1].name === reels[2].name || reels[0].name === reels[2].name) {
        totalMultiplier = 3;
        winLines = [`🎰 DOUBLE! 3x!`];
    } else if (reels.some(r => r.name === '7️⃣')) {
        totalMultiplier = 2;
        winLines = [`🎰 LUCKY 7! 2x!`];
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
    
    return { reels: reelsDisplay, totalMultiplier, winLines, win, winAmount, jackpotHit, jackpotAmount };
}

// DADU HOKI
function playDaduHoki(bet) {
    const dice = [rollDice(), rollDice(), rollDice()];
    const total = dice[0] + dice[1] + dice[2];
    let multiplier = 0;
    let winLines = [];
    
    if (dice[0] === 6 && dice[1] === 6 && dice[2] === 6) {
        multiplier = 150;
        winLines = ['🎲🎲🎲 666 JACKPOT! 150x!'];
    } else if (dice[0] === dice[1] && dice[1] === dice[2]) {
        multiplier = dice[0] === 1 ? 50 : dice[0] === 2 ? 45 : dice[0] === 3 ? 40 : dice[0] === 4 ? 35 : dice[0] === 5 ? 30 : 25;
        winLines = [`🎲 TRIPLE ${dice[0]}! ${multiplier}x!`];
    } else if (dice[0] === dice[1] || dice[1] === dice[2] || dice[0] === dice[2]) {
        multiplier = 5;
        winLines = [`🎲 DOUBLE! 5x!`];
    } else if (total >= 17) {
        multiplier = 8;
        winLines = [`🎲 GRAND TOTAL ${total}! 8x!`];
    } else if (total <= 4) {
        multiplier = 8;
        winLines = [`🎲 MINI TOTAL ${total}! 8x!`];
    } else if (total <= 6 || total >= 15) {
        multiplier = 4;
        winLines = [`🎲 GOOD TOTAL ${total}! 4x!`];
    }
    
    const win = multiplier > 0;
    const winAmount = win ? bet * multiplier : 0;
    return { dice, total, multiplier, winLines, win, winAmount };
}

// KARTU HOKI
function playKartuHoki(bet) {
    const cards = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const suits = ['♥️','♦️','♠️','♣️'];
    const draws = [];
    for (let i = 0; i < 3; i++) {
        draws.push({
            card: cards[Math.floor(Math.random() * cards.length)],
            suit: suits[Math.floor(Math.random() * suits.length)],
            value: cards.indexOf(draws[i]?.card) + 2
        });
    }
    
    const values = draws.map(d => {
        const idx = cards.indexOf(d.card);
        return idx + 2;
    });
    const sameSuit = draws.every(d => d.suit === draws[0].suit);
    const hasRoyal = values.includes(14) && values.includes(13) && values.includes(12);
    
    let multiplier = 0;
    let winLines = [];
    
    if (sameSuit && hasRoyal) {
        multiplier = 200;
        winLines = ['👑 ROYAL FLUSH! 200x!'];
    } else if (values[0] === values[1] && values[1] === values[2]) {
        multiplier = 50;
        winLines = [`🎴 THREE ${draws[0].card}! 50x!`];
    } else if (sameSuit) {
        multiplier = 15;
        winLines = ['💧 FLUSH! 15x!'];
    } else if (values[0] === values[1] || values[1] === values[2] || values[0] === values[2]) {
        multiplier = 5;
        winLines = ['🔰 PAIR! 5x!'];
    }
    
    const win = multiplier > 0;
    const winAmount = win ? bet * multiplier : 0;
    return { draws, multiplier, winLines, win, winAmount };
}

// ==================== STORAGE ====================
const activeGames = new Map(); // PVP games
const activePVH = new Map();   // VS Bot games

// ==================== BOT START ====================
async function startBot() {
    console.log('🎮 DUEL RXV TEAMRXVVX WhatsApp Bot starting...');
    
    const authDir = '/data/auth_info';
    const localAuthDir = './auth_info';
    
    if (!fs.existsSync('/data')) fs.mkdirSync('/data', { recursive: true });
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
    if (!fs.existsSync(localAuthDir)) fs.mkdirSync(localAuthDir, { recursive: true });
    
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ['DUEL RXV', 'Chrome', '1.0.0']
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('Reconnecting...');
                setTimeout(() => startBot(), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ BOT ONLINE!');
            console.log(`💰 Jackpot Pool: ${formatNumber(db.jackpotPool)} coin`);
            
            try {
                await sock.sendMessage(config.ownerNumber + '@s.whatsapp.net', 
                    `🎮 *${config.botName}* ONLINE!\n💰 Jackpot: ${formatNumber(db.jackpotPool)} coin\n📱 Ketik .menu untuk mulai!`
                );
            } catch (err) {}
        }
    });
    
    // Clean expired games every minute
    setInterval(() => {
        const now = Date.now();
        for (const [id, game] of activeGames.entries()) {
            if (game.expiresAt < now) {
                const host = db.users[game.hostId];
                if (host) { host.coins += game.betAmount; saveDB(); }
                activeGames.delete(id);
            }
        }
        for (const [id, game] of activePVH.entries()) {
            if (game.expiresAt < now) {
                const player = db.users[game.playerId];
                if (player) { player.coins += game.betAmount; saveDB(); }
                activePVH.delete(id);
            }
        }
    }, 60000);
    
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
                    `💰 *JACKPOT POOL:* ${formatNumber(db.jackpotPool)} 🪙\n\n` +
                    
                    `⚔️ *PVP GAMES (5 RONDE)*\n` +
                    `└ .reme [jumlah] - Reme PVP\n` +
                    `└ .qeme [jumlah] - Qeme PVP\n` +
                    `└ .qq [jumlah] - QQ PVP\n` +
                    `└ .csn [jumlah] - CSN PVP\n` +
                    `└ .btk [jumlah] - BTK PVP\n` +
                    `└ .dirt [jumlah] - Dirt Seed\n` +
                    `└ .bc [jumlah] - Baccarat\n` +
                    `└ .bj [jumlah] - Blackjack\n` +
                    `└ .kb [k/b] [jumlah] - Kecil/Besar\n` +
                    `└ .dadu [jumlah] - Adu Dadu\n` +
                    `└ .card [jumlah] - Adu Kartu\n` +
                    `└ .flip [jumlah] - Coinflip\n\n` +
                    
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
                    
                    `🎁 *GIFT & JACKPOT:*\n` +
                    `└ .tukar [kode] - Redeem Gift\n` +
                    `└ .jackpot - Info Jackpot\n` +
                    `└ .history - History Jackpot\n\n` +
                    
                    `🔍 *FITUR ROOM:*\n` +
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
                    `2. Join: .remej ABC123\n` +
                    `3. Main 5 ronde, skor tertinggi menang\n\n` +
                    
                    `🤝 *PVH GAME (VS BOT):*\n` +
                    `1. Host: .hleme 500\n` +
                    `2. Join: .leme ABC123\n` +
                    `3. Lawan bot 5 ronde\n\n` +
                    
                    `🎰 *JUDOL HOKI-HOKIAN:*\n` +
                    `• .slot 1000 - Slot Machine\n` +
                    `• .dadu 1000 - Dadu Hoki\n` +
                    `• .kartu 1000 - Kartu Hoki\n\n` +
                    
                    `💡 *ODDS:*\n` +
                    `• SLOT: Jackpot 200x | Big Win 100x\n` +
                    `• DADU: 666 = 150x | Triple = 25-50x\n` +
                    `• KARTU: Royal Flush = 200x\n\n` +
                    
                    `💰 *JACKPOT PROGRESSIF:*\n` +
                    `• 10% taruhan masuk jackpot pool\n` +
                    `• Chance dapat jackpot saat menang besar\n\n` +
                    
                    `📱 *DEPOSIT:* ${config.deposit.dana}`;
                
                await sock.sendMessage(from, { text: help });
            }
            
            // ==================== PVP HOST ====================
            async function handleHost(gameType, bet, joinCmd, gameFunc) {
                if (isNaN(bet) || bet <= 0) return await sock.sendMessage(from, { text: `❌ Gunakan: .${cmd} jumlah` });
                if (user.coins < bet) return await sock.sendMessage(from, { text: `❌ Coin tidak cukup! Kamu punya ${formatNumber(user.coins)} coin` });
                
                const gameId = generateId();
                user.coins -= bet;
                saveDB();
                
                const game = {
                    id: gameId, type: gameType,
                    hostId: senderId, hostName: pushName,
                    betAmount: bet, status: 'waiting',
                    joinCmd: joinCmd, gameFunc: gameFunc,
                    rounds: 5,
                    expiresAt: Date.now() + config.gameExpireTime
                };
                activeGames.set(gameId, game);
                
                const fee = Math.floor(bet * 2 * config.fee.percentage / 100);
                await sock.sendMessage(from, { text: 
                    `🎮 *HOST ${gameType}*\n` +
                    `ID: \`${gameId}\`\n` +
                    `💰 Taruhan: ${formatNumber(bet)} coin\n` +
                    `💎 Pemenang dapat: ${formatNumber(bet*2 - fee)} coin\n` +
                    `📝 Join: .${joinCmd} ${gameId}`
                });
            }
            
            // ==================== PVP JOIN ====================
            async function handleJoin(gameType, gameId, gameFunc) {
                const game = activeGames.get(gameId);
                if (!game) return await sock.sendMessage(from, { text: '❌ Game tidak ditemukan!' });
                if (game.type !== gameType) return await sock.sendMessage(from, { text: `❌ Ini bukan game ${gameType}!` });
                if (game.hostId === senderId) return await sock.sendMessage(from, { text: '❌ Tidak bisa join game sendiri!' });
                
                const joiner = user;
                if (joiner.coins < game.betAmount) return await sock.sendMessage(from, { text: `❌ Coin tidak cukup! Butuh ${formatNumber(game.betAmount)} coin` });
                
                joiner.coins -= game.betAmount;
                const host = db.users[game.hostId];
                
                const result = gameFunc(5);
                let winner = null, winnerObj = null, winnerName = '';
                if (result.playerWins > result.opponentWins) {
                    winner = game.hostId; winnerName = game.hostName; winnerObj = host;
                } else if (result.opponentWins > result.playerWins) {
                    winner = senderId; winnerName = pushName; winnerObj = joiner;
                }
                
                const totalPot = game.betAmount * 2;
                const fee = Math.floor(totalPot * config.fee.percentage / 100);
                
                if (winner) {
                    winnerObj.coins += totalPot - fee;
                    winnerObj.gamesWon++;
                    if (winnerObj.userId !== 'BOT') db.feeWallet += fee;
                } else {
                    host.coins += game.betAmount;
                    joiner.coins += game.betAmount;
                }
                
                host.gamesPlayed++; joiner.gamesPlayed++;
                host.gamesVsPlayer++; joiner.gamesVsPlayer++;
                saveDB();
                activeGames.delete(gameId);
                
                const resultsText = result.results.join('\n');
                const message = 
                    `🎮 *${gameType} - 5 RONDE*\n` +
                    `${game.hostName} vs ${pushName}\n\n` +
                    `${resultsText}\n\n` +
                    `📊 Skor: ${game.hostName} ${result.playerWins} - ${result.opponentWins} ${pushName}\n` +
                    `💰 Taruhan: ${formatNumber(game.betAmount)} coin/player\n` +
                    (winner ? `🏆 *Pemenang: ${winnerName}*\n💸 Mendapat: ${formatNumber(totalPot - fee)} coin` : `🤝 *DRAW!* Taruhan dikembalikan`);
                
                await sock.sendMessage(from, { text: message });
            }
            
            // ==================== HOST PVH ====================
            async function handlePVHHost(gameType, bet, joinCmd) {
                if (isNaN(bet) || bet <= 0) return await sock.sendMessage(from, { text: `❌ Gunakan: .${cmd} jumlah` });
                if (user.coins < bet) return await sock.sendMessage(from, { text: `❌ Coin tidak cukup! Kamu punya ${formatNumber(user.coins)} coin` });
                
                const gameId = generateId();
                user.coins -= bet;
                saveDB();
                
                const game = {
                    id: gameId, type: gameType,
                    playerId: senderId, playerName: pushName,
                    betAmount: bet, status: 'waiting',
                    joinCmd: joinCmd,
                    rounds: 5,
                    expiresAt: Date.now() + config.gameExpireTime
                };
                activePVH.set(gameId, game);
                
                const fee = Math.floor(bet * 2 * config.fee.percentage / 100);
                await sock.sendMessage(from, { text: 
                    `🎮 *HOST ${gameType} (VS BOT)*\n` +
                    `ID: \`${gameId}\`\n` +
                    `💰 Taruhan: ${formatNumber(bet)} coin\n` +
                    `💎 Menang dapat: ${formatNumber(bet*2 - fee)} coin\n` +
                    `📝 Join: .${joinCmd} ${gameId}`
                });
            }
            
            // ==================== JOIN PVH ====================
            async function handlePVHJoin(gameType, gameId) {
                const game = activePVH.get(gameId);
                if (!game) return await sock.sendMessage(from, { text: '❌ Game tidak ditemukan!' });
                if (game.playerId === senderId) return await sock.sendMessage(from, { text: '❌ Tidak bisa melawan diri sendiri!' });
                
                const player = user;
                if (player.coins < game.betAmount) return await sock.sendMessage(from, { text: `❌ Coin tidak cukup! Butuh ${formatNumber(game.betAmount)} coin` });
                
                player.coins -= game.betAmount;
                const host = db.users[game.playerId];
                
                let playerWins = 0, botWins = 0, results = [];
                for (let r = 1; r <= 5; r++) {
                    const playerScore = Math.floor(Math.random() * 100) + 1;
                    const botScore = Math.floor(Math.random() * 100) + 1;
                    if (playerScore > botScore) { playerWins++; results.push(`Ronde ${r}: 🎯 ${playerScore} vs 🤖 ${botScore} ✅`); }
                    else if (botScore > playerScore) { botWins++; results.push(`Ronde ${r}: 🎯 ${playerScore} vs 🤖 ${botScore} ❌`); }
                    else results.push(`Ronde ${r}: 🎯 ${playerScore} vs 🤖 ${botScore} 🤝`);
                }
                
                const totalPot = game.betAmount * 2;
                const fee = Math.floor(totalPot * config.fee.percentage / 100);
                let resultText = '';
                
                if (playerWins > botWins) {
                    player.coins += totalPot - fee;
                    player.gamesWon++;
                    db.feeWallet += fee;
                    resultText = `🎉 *KAMU MENANG!*\n💸 Mendapat: ${formatNumber(totalPot - fee)} coin`;
                } else if (botWins > playerWins) {
                    db.feeWallet += fee;
                    resultText = `😢 *BOT MENANG!*\n💸 Kerugian: -${formatNumber(game.betAmount)} coin`;
                } else {
                    player.coins += game.betAmount;
                    host.coins += game.betAmount;
                    resultText = `🤝 *DRAW!* Taruhan dikembalikan`;
                }
                
                player.gamesPlayed++; player.gamesVsBot++;
                host.gamesVsBot++;
                saveDB();
                activePVH.delete(gameId);
                
                const resultsText = results.join('\n');
                await sock.sendMessage(from, { text: 
                    `🎮 *${gameType} VS BOT - 5 RONDE*\n` +
                    `${pushName} vs *BOT*\n\n` +
                    `${resultsText}\n\n` +
                    `📊 Skor: Kamu ${playerWins} - ${botWins} Bot\n` +
                    `💰 Taruhan: ${formatNumber(game.betAmount)} coin\n` +
                    `${resultText}`
                });
            }
            
            // ==================== ALL HOST COMMANDS ====================
            const hostCommands = {
                reme: ['REME', 'remej', playReme],
                qeme: ['QEME', 'qemej', playQeme],
                qq: ['QQ', 'qqj', playQQ],
                csn: ['CSN', 'csnj', playCSN],
                btk: ['BTK', 'btkj', playBTK],
                dirt: ['DIRT', 'dirtj', playDirt],
                bc: ['BC', 'bcj', playBC],
                bj: ['BJ', 'bjj', playBJ],
                dadu: ['DADU', 'daduj', playDadu],
                card: ['CARD', 'cardj', playCard],
                flip: ['FLIP', 'flipj', playFlip]
            };
            
            if (hostCommands[cmd]) {
                const [gameType, joinCmd, gameFunc] = hostCommands[cmd];
                return await handleHost(gameType, parseInt(args[0]), joinCmd, gameFunc);
            }
            
            // ==================== KB HOST ====================
            if (cmd === 'kb') {
                if (args.length < 2) return await sock.sendMessage(from, { text: '❌ Gunakan: `.kb <k/b> jumlah`' });
                const choice = args[0].toLowerCase();
                const bet = parseInt(args[1]);
                if (choice !== 'k' && choice !== 'b') return await sock.sendMessage(from, { text: '❌ Pilih "k" atau "b"' });
                if (isNaN(bet) || bet <= 0) return await sock.sendMessage(from, { text: '❌ Jumlah tidak valid' });
                if (user.coins < bet) return await sock.sendMessage(from, { text: `❌ Coin tidak cukup! Kamu punya ${formatNumber(user.coins)} coin` });
                
                const gameId = generateId();
                user.coins -= bet;
                saveDB();
                
                const game = {
                    id: gameId, type: 'KB',
                    hostId: senderId, hostName: pushName,
                    hostChoice: choice === 'k' ? 'KECIL' : 'BESAR',
                    betAmount: bet, status: 'waiting',
                    joinCmd: 'kbj',
                    rounds: 5,
                    expiresAt: Date.now() + config.gameExpireTime
                };
                activeGames.set(gameId, game);
                
                await sock.sendMessage(from, { text: 
                    `🎮 *HOST KB*\nID: \`${gameId}\`\n🎯 Pilihan: ${choice === 'k' ? 'KECIL' : 'BESAR'}\n💰 Taruhan: ${formatNumber(bet)} coin\n📝 Join: .kbj ${gameId}`
                });
            }
            
            // ==================== ALL JOIN COMMANDS ====================
            const joinCommands = {
                remej: ['REME', playReme],
                qemej: ['QEME', playQeme],
                qqj: ['QQ', playQQ],
                csnj: ['CSN', playCSN],
                btkj: ['BTK', playBTK],
                dirtj: ['DIRT', playDirt],
                bcj: ['BC', playBC],
                bjj: ['BJ', playBJ],
                daduj: ['DADU', playDadu],
                cardj: ['CARD', playCard],
                flipj: ['FLIP', playFlip]
            };
            
            if (joinCommands[cmd]) {
                const [gameType, gameFunc] = joinCommands[cmd];
                return await handleJoin(gameType, args[0]?.toUpperCase(), gameFunc);
            }
            
            // ==================== KB JOIN ====================
            if (cmd === 'kbj') {
                const gameId = args[0]?.toUpperCase();
                const game = activeGames.get(gameId);
                if (!game) return await sock.sendMessage(from, { text: '❌ Game tidak ditemukan!' });
                if (game.type !== 'KB') return await sock.sendMessage(from, { text: '❌ Bukan game KB!' });
                if (game.hostId === senderId) return await sock.sendMessage(from, { text: '❌ Tidak bisa join sendiri!' });
                
                const joiner = user;
                if (joiner.coins < game.betAmount) return await sock.sendMessage(from, { text: `❌ Coin tidak cukup! Butuh ${formatNumber(game.betAmount)} coin` });
                
                joiner.coins -= game.betAmount;
                const host = db.users[game.hostId];
                
                const result = playKB(5, game.hostChoice);
                let winner = null, winnerObj = null, winnerName = '';
                if (result.playerWins > result.opponentWins) {
                    winner = game.hostId; winnerName = game.hostName; winnerObj = host;
                } else if (result.opponentWins > result.playerWins) {
                    winner = senderId; winnerName = pushName; winnerObj = joiner;
                }
                
                const totalPot = game.betAmount * 2;
                const fee = Math.floor(totalPot * config.fee.percentage / 100);
                
                if (winner) {
                    winnerObj.coins += totalPot - fee;
                    winnerObj.gamesWon++;
                    db.feeWallet += fee;
                } else {
                    host.coins += game.betAmount;
                    joiner.coins += game.betAmount;
                }
                
                host.gamesPlayed++; joiner.gamesPlayed++;
                saveDB();
                activeGames.delete(gameId);
                
                const resultsText = result.results.join('\n');
                await sock.sendMessage(from, { text: 
                    `🎮 *KB - 5 RONDE*\n${game.hostName} vs ${pushName}\n\n${resultsText}\n\n📊 Skor: ${game.hostName} ${result.playerWins} - ${result.opponentWins} ${pushName}\n💰 Taruhan: ${formatNumber(game.betAmount)} coin\n` +
                    (winner ? `🏆 *Pemenang: ${winnerName}*\n💸 Mendapat: ${formatNumber(totalPot - fee)} coin` : `🤝 *DRAW!* Taruhan dikembalikan`)
                });
            }
            
            // ==================== PVH HOST ====================
            const pvhHost = {
                hleme: ['LEME', 'leme'],
                hreme: ['REME', 'reme'],
                hlewa: ['LEWA', 'lewa'],
                hr: ['REWA', 'rw']
            };
            
            if (pvhHost[cmd]) {
                const [gameType, joinCmd] = pvhHost[cmd];
                return await handlePVHHost(gameType, parseInt(args[0]), joinCmd);
            }
            
            // ==================== PVH JOIN ====================
            const pvhJoin = {
                leme: 'LEME',
                reme: 'REME',
                lewa: 'LEWA',
                rw: 'REWA'
            };
            
            if (pvhJoin[cmd]) {
                return await handlePVHJoin(pvhJoin[cmd], args[0]?.toUpperCase());
            }
            
            // ==================== SLOT JUDOL ====================
            if (cmd === 'slot') {
                const bet = parseInt(args[0]);
                if (isNaN(bet) || bet <= 0) return await sock.sendMessage(from, { text: '❌ Gunakan: `.slot 1000`' });
                if (user.coins < bet) return await sock.sendMessage(from, { text: `❌ Coin tidak cukup! Kamu punya ${formatNumber(user.coins)} coin` });
                
                user.coins -= bet;
                user.totalBet += bet;
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
                
                user.coins += winAmount;
                if (result.win || result.jackpotHit) {
                    user.gamesWon++;
                    user.totalWin += winAmount;
                    user.winStreak++;
                    user.loseStreak = 0;
                } else {
                    user.gamesLost++;
                    user.totalLoss += bet;
                    user.loseStreak++;
                    user.winStreak = 0;
                }
                user.gamesPlayed++;
                
                updateJackpot(bet);
                saveDB();
                
                const winLinesText = result.winLines.join('\n');
                await sock.sendMessage(from, { text: 
                    `🎰 *SLOT HOKI*\n` +
                    `┌─────┬─────┬─────┐\n` +
                    `│  ${result.reels[0]}  │  ${result.reels[1]}  │  ${result.reels[2]}  │\n` +
                    `└─────┴─────┴─────┘\n\n` +
                    `${winLinesText}\n\n` +
                    `💰 Taruhan: ${formatNumber(bet)} coin\n` +
                    (result.win || result.jackpotHit ? 
                        `🎁 *MENANG:* ${formatNumber(winAmount)} coin\n` +
                        (jackpotAmount > 0 ? `👑 *JACKPOT:* +${formatNumber(jackpotAmount)} coin 👑\n` : '') :
                        `😢 *KALAH:* -${formatNumber(bet)} coin\n`) +
                    `💳 Saldo: ${formatNumber(user.coins)} coin\n` +
                    `🎰 Jackpot Pool: ${formatNumber(db.jackpotPool)} coin\n` +
                    `📊 Streak: ${user.winStreak > 0 ? `🔥 ${user.winStreak} win` : `❄️ ${user.loseStreak} lose`}`
                });
            }
            
            // ==================== DADU JUDOL ====================
            if (cmd === 'dadu' && !['reme', 'qeme', 'qq', 'csn', 'btk', 'dirt', 'bc', 'bj', 'kb', 'card', 'flip'].includes(cmd)) {
                const bet = parseInt(args[0]);
                if (isNaN(bet) || bet <= 0) return await sock.sendMessage(from, { text: '❌ Gunakan: `.dadu 1000`' });
                if (user.coins < bet) return await sock.sendMessage(from, { text: `❌ Coin tidak cukup! Kamu punya ${formatNumber(user.coins)} coin` });
                
                user.coins -= bet;
                user.totalBet += bet;
                const result = playDaduHoki(bet);
                user.coins += result.winAmount;
                
                if (result.win) {
                    user.gamesWon++;
                    user.totalWin += result.winAmount;
                    user.winStreak++;
                    user.loseStreak = 0;
                } else {
                    user.gamesLost++;
                    user.totalLoss += bet;
                    user.loseStreak++;
                    user.winStreak = 0;
                }
                user.gamesPlayed++;
                
                updateJackpot(bet);
                saveDB();
                
                const winLinesText = result.winLines.join('\n');
                await sock.sendMessage(from, { text: 
                    `🎲 *DADU HOKI*\n` +
                    `┌─────┬─────┬─────┐\n` +
                    `│  ${result.dice[0]}  │  ${result.dice[1]}  │  ${result.dice[2]}  │\n` +
                    `└─────┴─────┴─────┘\n` +
                    `📊 Total: ${result.total}\n\n` +
                    `${winLinesText}\n\n` +
                    `💰 Taruhan: ${formatNumber(bet)} coin\n` +
                    (result.win ? `🎁 *MENANG:* ${formatNumber(result.winAmount)} coin (${result.multiplier}x)\n` : `😢 *KALAH:* -${formatNumber(bet)} coin\n`) +
                    `💳 Saldo: ${formatNumber(user.coins)} coin\n` +
                    `🎰 Jackpot Pool: ${formatNumber(db.jackpotPool)} coin\n` +
                    `📊 Streak: ${user.winStreak > 0 ? `🔥 ${user.winStreak} win` : `❄️ ${user.loseStreak} lose`}`
                });
            }
            
            // ==================== KARTU JUDOL ====================
            if (cmd === 'kartu' && !['card', 'kartuj', 'kartuj'].includes(cmd)) {
                const bet = parseInt(args[0]);
                if (isNaN(bet) || bet <= 0) return await sock.sendMessage(from, { text: '❌ Gunakan: `.kartu 1000`' });
                if (user.coins < bet) return await sock.sendMessage(from, { text: `❌ Coin tidak cukup! Kamu punya ${formatNumber(user.coins)} coin` });
                
                user.coins -= bet;
                user.totalBet += bet;
                const result = playKartuHoki(bet);
                user.coins += result.winAmount;
                
                if (result.win) {
                    user.gamesWon++;
                    user.totalWin += result.winAmount;
                    user.winStreak++;
                    user.loseStreak = 0;
                } else {
                    user.gamesLost++;
                    user.totalLoss += bet;
                    user.loseStreak++;
                    user.winStreak = 0;
                }
                user.gamesPlayed++;
                
                updateJackpot(bet);
                saveDB();
                
                const cardsText = result.draws.map(d => `${d.suit}${d.card}`).join(' | ');
                const winLinesText = result.winLines.join('\n');
                await sock.sendMessage(from, { text: 
                    `🎴 *KARTU HOKI*\n` +
                    `🃏 ${cardsText}\n\n` +
                    `${winLinesText}\n\n` +
                    `💰 Taruhan: ${formatNumber(bet)} coin\n` +
                    (result.win ? `🎁 *MENANG:* ${formatNumber(result.winAmount)} coin (${result.multiplier}x)\n` : `😢 *KALAH:* -${formatNumber(bet)} coin\n`) +
                    `💳 Saldo: ${formatNumber(user.coins)} coin\n` +
                    `🎰 Jackpot Pool: ${formatNumber(db.jackpotPool)} coin\n` +
                    `📊 Streak: ${user.winStreak > 0 ? `🔥 ${user.winStreak} win` : `❄️ ${user.loseStreak} lose`}`
                });
            }
            
            // ==================== ROOMS ====================
            if (cmd === 'rooms') {
                if (activeGames.size === 0 && activePVH.size === 0) {
                    return await sock.sendMessage(from, { text: '📭 Tidak ada room tersedia.' });
                }
                
                let roomText = '🎮 *ROOM TERSEDIA:*\n\n';
                for (const [id, g] of activeGames.entries()) {
                    const timeLeft = Math.max(0, Math.ceil((g.expiresAt - Date.now())/1000/60*10)/10);
                    roomText += `⚔️ *${g.type}* | ID: ${id} | Host: ${g.hostName} | ${formatNumber(g.betAmount)} coin | ⏳ ${timeLeft}m\nJoin: .${g.joinCmd} ${id}\n\n`;
                }
                for (const [id, g] of activePVH.entries()) {
                    const timeLeft = Math.max(0, Math.ceil((g.expiresAt - Date.now())/1000/60*10)/10);
                    roomText += `🤖 *${g.type} (VS BOT)* | ID: ${id} | Host: ${g.playerName} | ${formatNumber(g.betAmount)} coin | ⏳ ${timeLeft}m\nJoin: .${g.joinCmd} ${id}\n\n`;
                }
                await sock.sendMessage(from, { text: roomText });
            }
            
            // ==================== CANCEL ROOM ====================
            if (cmd === 'cancel') {
                const gameId = args[0]?.toUpperCase();
                if (!gameId) return await sock.sendMessage(from, { text: '❌ Gunakan: `.cancel ID`' });
                
                let game = activeGames.get(gameId);
                if (game) {
                    if (game.hostId !== senderId) return await sock.sendMessage(from, { text: '❌ Kamu bukan host!' });
                    const host = db.users[game.hostId];
                    host.coins += game.betAmount;
                    saveDB();
                    activeGames.delete(gameId);
                    return await sock.sendMessage(from, { text: `✅ Room ${gameId} dibatalkan. Coin dikembalikan.` });
                }
                
                game = activePVH.get(gameId);
                if (game) {
                    if (game.playerId !== senderId) return await sock.sendMessage(from, { text: '❌ Kamu bukan host!' });
                    const player = db.users[game.playerId];
                    player.coins += game.betAmount;
                    saveDB();
                    activePVH.delete(gameId);
                    return await sock.sendMessage(from, { text: `✅ Room ${gameId} dibatalkan. Coin dikembalikan.` });
                }
                
                await sock.sendMessage(from, { text: '❌ Game tidak ditemukan!' });
            }
            
            // ==================== CC ====================
            if (cmd === 'cc') {
                let targetId = senderId;
                let targetName = pushName;
                if (args.length > 0) {
                    const mention = args[0].replace('@', '');
                    targetId = cleanNumber(mention);
                    targetName = db.users[targetId]?.username || targetId;
                }
                const targetUser = db.users[targetId] || { coins: 0, gamesPlayed: 0, gamesWon: 0, totalWin: 0, winStreak: 0 };
                await sock.sendMessage(from, { text: 
                    `💰 *${targetName}*\n` +
                    `💎 Coin: ${formatNumber(targetUser.coins)} 🪙\n` +
                    `🎮 Games: ${targetUser.gamesPlayed} | 🏆 Menang: ${targetUser.gamesWon} | 💀 Kalah: ${targetUser.gamesLost || 0}\n` +
                    `📈 Win Rate: ${targetUser.gamesPlayed > 0 ? Math.floor((targetUser.gamesWon / targetUser.gamesPlayed) * 100) : 0}%\n` +
                    `🔥 Streak: ${targetUser.winStreak > 0 ? `${targetUser.winStreak} win 🔥` : targetUser.loseStreak > 0 ? `${targetUser.loseStreak} lose ❄️` : '0'}\n` +
                    `💰 Total Bet: ${formatNumber(targetUser.totalBet || 0)} | 🎁 Total Win: ${formatNumber(targetUser.totalWin || 0)}`
                });
            }
            
            // ==================== LB ====================
            if (cmd === 'lb') {
                const users = Object.values(db.users).sort((a,b) => b.coins - a.coins).slice(0,10);
                if (users.length === 0) return await sock.sendMessage(from, { text: '❌ Belum ada data' });
                let message = `🏆 *TOP 10 LEADERBOARD*\n\n`;
                for (let i=0; i<users.length; i++) {
                    const u = users[i];
                    const winRate = u.gamesPlayed > 0 ? Math.floor((u.gamesWon / u.gamesPlayed) * 100) : 0;
                    message += `${i+1}. *${u.username}*\n   💰 ${formatNumber(u.coins)} 🪙 | 🎯 ${winRate}% win\n`;
                }
                await sock.sendMessage(from, { text: message });
            }
            
            // ==================== SPIN ====================
            if (cmd === 'spin') {
                const dice = [rollDice(), rollDice(), rollDice()];
                const total = dice[0] + dice[1] + dice[2];
                let message = '';
                if (total === 18) message = '🎉 *JACKPOT!* Semua angka 6!';
                else if (total >= 15) message = '⭐ Bagus! Angka besar!';
                else if (total <= 5) message = '😅 Wah kecil sekali...';
                else message = '👍 Lumayan!';
                
                await sock.sendMessage(from, { text: 
                    `🎲 *SPIN GRATIS*\n${pushName} melempar 3 dadu!\n\n🎲 ${dice[0]} | ${dice[1]} | ${dice[2]} = *${total}*\n${message}\n\n*Spin ini gratis, tidak mempengaruhi coin*`
                });
            }
            
            // ==================== DEPO ====================
            if (cmd === 'depo') {
                await sock.sendMessage(from, { text: 
                    `💰 *DEPOSIT COIN*\n📱 DANA: ${config.deposit.dana}\n📱 OVO: ${config.deposit.ovo}\n📱 GOPAY: ${config.deposit.gopay}\n💎 Rate: Rp 10.000 = 1000 coin\n📋 Kirim bukti ke admin`
                });
            }
            
            // ==================== TF ====================
            if (cmd === 'tf') {
                if (args.length < 2) return await sock.sendMessage(from, { text: '❌ Gunakan: `.tf @nomor jumlah`' });
                const targetMention = args[0].replace('@', '');
                const targetId = cleanNumber(targetMention);
                const amount = parseInt(args[1]);
                if (!targetId || targetId.length < 10) return await sock.sendMessage(from, { text: '❌ Nomor tidak valid!' });
                if (targetId === senderId) return await sock.sendMessage(from, { text: '❌ Tidak bisa transfer ke diri sendiri!' });
                if (isNaN(amount) || amount <= 0) return await sock.sendMessage(from, { text: '❌ Jumlah tidak valid!' });
                if (user.coins < amount) return await sock.sendMessage(from, { text: `❌ Coin tidak cukup! Kamu punya ${formatNumber(user.coins)} coin` });
                
                const receiver = db.users[targetId] || { userId: targetId, username: targetId, coins: 0 };
                db.users[targetId] = receiver;
                user.coins -= amount;
                receiver.coins += amount;
                saveDB();
                await sock.sendMessage(from, { text: `💸 *TRANSFER*\n${pushName} → @${targetId}\n💰 ${formatNumber(amount)} coin\n💳 Sisa: ${formatNumber(user.coins)} coin` });
            }
            
            // ==================== TUKAR ====================
            if (cmd === 'tukar') {
                if (!args[0]) return await sock.sendMessage(from, { text: '❌ Gunakan: `.tukar KODE`' });
                const code = args[0].toUpperCase();
                const gift = db.giftCodes.find(g => g.code === code && !g.used);
                if (!gift) return await sock.sendMessage(from, { text: '❌ Kode tidak valid atau sudah digunakan!' });
                if (new Date(gift.expiresAt) < new Date()) return await sock.sendMessage(from, { text: '❌ Kode sudah expired!' });
                
                user.coins += gift.coins;
                gift.used = true;
                gift.usedBy = senderId;
                gift.usedByUsername = pushName;
                gift.usedAt = new Date().toISOString();
                saveDB();
                await sock.sendMessage(from, { text: `🎁 *REDEEM BERHASIL*\nKode: ${code}\n💰 +${formatNumber(gift.coins)} coin\n💳 Total: ${formatNumber(user.coins)} 🪙` });
            }
            
            // ==================== JACKPOT ====================
            if (cmd === 'jackpot') {
                let message = `💰 *JACKPOT POOL*\n💎 Total: ${formatNumber(db.jackpotPool)} coin\n\n`;
                if (db.lastJackpotWinner) {
                    message += `🏆 *LAST WINNER:*\n👤 ${db.lastJackpotWinner.username}\n🎁 ${formatNumber(db.lastJackpotWinner.amount)} coin\n📅 ${new Date(db.lastJackpotWinner.time).toLocaleString()}\n\n`;
                }
                message += `🎯 *CARA MENANGKAN JACKPOT:*\n• Main game judol (slot/dadu/kartu)\n• Dapatkan kombinasi langka\n• 1% chance dapat jackpot saat menang besar`;
                await sock.sendMessage(from, { text: message });
            }
            
            // ==================== HISTORY ====================
            if (cmd === 'history') {
                if (db.jackpotHistory.length === 0) return await sock.sendMessage(from, { text: '📭 Belum ada history jackpot' });
                let message = `🏆 *HISTORY JACKPOT*\n\n`;
                db.jackpotHistory.slice().reverse().forEach((h, i) => {
                    message += `${i+1}. ${h.username}\n   🎁 ${formatNumber(h.amount)} coin\n   📅 ${new Date(h.time).toLocaleString()}\n\n`;
                });
                await sock.sendMessage(from, { text: message });
            }
            
            // ==================== ADMIN ====================
            if (senderId === config.ownerNumber) {
                if (cmd === 'addcoin') {
                    if (args.length < 2) return await sock.sendMessage(from, { text: '❌ Gunakan: `.addcoin @nomor jumlah`' });
                    const targetMention = args[0].replace('@', '');
                    const targetId = cleanNumber(targetMention);
                    const amount = parseInt(args[1]);
                    if (!targetId || targetId.length < 10) return await sock.sendMessage(from, { text: '❌ Nomor tidak valid!' });
                    if (isNaN(amount) || amount <= 0) return await sock.sendMessage(from, { text: '❌ Jumlah tidak valid!' });
                    
                    const targetUser = db.users[targetId] || { userId: targetId, username: targetId, coins: 0 };
                    db.users[targetId] = targetUser;
                    targetUser.coins += amount;
                    saveDB();
                    await sock.sendMessage(from, { text: `✅ ADD COIN\n@${targetId} +${formatNumber(amount)} coin` });
                }
                
                if (cmd === 'delcoin') {
                    if (args.length < 2) return await sock.sendMessage(from, { text: '❌ Gunakan: `.delcoin @nomor jumlah`' });
                    const targetMention = args[0].replace('@', '');
                    const targetId = cleanNumber(targetMention);
                    const amount = parseInt(args[1]);
                    if (!targetId || targetId.length < 10) return await sock.sendMessage(from, { text: '❌ Nomor tidak valid!' });
                    if (isNaN(amount) || amount <= 0) return await sock.sendMessage(from, { text: '❌ Jumlah tidak valid!' });
                    
                    const targetUser = db.users[targetId];
                    if (!targetUser) return await sock.sendMessage(from, { text: '❌ User tidak ditemukan!' });
                    if (targetUser.coins < amount) return await sock.sendMessage(from, { text: `❌ User hanya punya ${formatNumber(targetUser.coins)} coin` });
                    targetUser.coins -= amount;
                    saveDB();
                    await sock.sendMessage(from, { text: `✅ DEL COIN\n@${targetId} -${formatNumber(amount)} coin` });
                }
                
                if (cmd === 'creategift') {
                    if (args.length < 1) return await sock.sendMessage(from, { text: '❌ Gunakan: `.creategift jumlah [kode] [hari]`' });
                    const amount = parseInt(args[0]);
                    if (isNaN(amount) || amount <= 0) return await sock.sendMessage(from, { text: '❌ Jumlah tidak valid!' });
                    let code = args[1]?.toUpperCase() || Math.random().toString(36).substring(2, 8).toUpperCase();
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
                
                if (cmd === 'giftlist') {
                    const active = db.giftCodes.filter(g => !g.used);
                    const used = db.giftCodes.filter(g => g.used);
                    let message = `🎁 *GIFT CODE*\n\n🟢 AKTIF (${active.length}):\n`;
                    active.forEach(g => message += `• ${g.code} - ${formatNumber(g.coins)} coin\n`);
                    message += `\n✅ TERPAKAI (${used.length}):\n`;
                    used.slice(-5).forEach(g => message += `• ${g.code} - oleh ${g.usedByUsername}\n`);
                    await sock.sendMessage(from, { text: message });
                }
                
                if (cmd === 'feestatus') {
                    await sock.sendMessage(from, { text: `💰 *FEE STATUS*\nFee: ${config.fee.percentage}%\nMin: ${config.fee.minFee} | Max: ${config.fee.maxFee}\nTotal: ${formatNumber(db.feeWallet)} 🪙` });
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
    process.exit(1);
});

console.log('🎮 DUEL RXV TEAMRXVVX WhatsApp Bot starting...');
console.log('📱 Scan QR code yang muncul di logs Railway');
