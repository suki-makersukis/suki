// DUEL RXV TEAMRXVVX - WHATSAPP BOT (FIXED CRYPTO ERROR)
// Simpan sebagai index.js

// ==================== CRYPTO POLYFILL ====================
if (typeof globalThis.crypto === 'undefined') {
    const crypto = require('crypto');
    globalThis.crypto = crypto;
}
console.log('✅ Crypto module loaded');

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// ==================== KONFIGURASI ====================
const config = {
    prefix: ".",
    botNumber: process.env.BOT_NUMBER || "6283173495612",
    botName: "DUEL RXV TEAMRXVVX",
    botEmoji: "🎮",
    coinEmoji: "🪙",
    version: "Valentine Edition - Multi Owner",
    
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

function loadDatabase() {
    try {
        if (fs.existsSync(DB_PATH)) {
            db = JSON.parse(fs.readFileSync(DB_PATH));
            console.log('✅ Database loaded from persistent storage');
        } else if (fs.existsSync(LOCAL_DB_PATH)) {
            db = JSON.parse(fs.readFileSync(LOCAL_DB_PATH));
            fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
            console.log('✅ Database loaded from local');
        } else {
            db.roles.owners = [config.botNumber];
            fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
            fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2));
            console.log('✅ Database created');
        }
    } catch (err) {
        console.log('Database error:', err);
    }
}

function saveDB() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2));
    } catch (err) {}
}

loadDatabase();

// ==================== ROLE FUNCTIONS ====================
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

function addOwner(number) {
    const cleanNum = cleanNumber(number);
    if (!db.roles.owners.includes(cleanNum)) {
        db.roles.owners.push(cleanNum);
        saveDB();
        return true;
    }
    return false;
}

function removeOwner(number) {
    const cleanNum = cleanNumber(number);
    const index = db.roles.owners.indexOf(cleanNum);
    if (index > -1 && cleanNum !== config.botNumber) {
        db.roles.owners.splice(index, 1);
        saveDB();
        return true;
    }
    return false;
}

function addSeller(number) {
    const cleanNum = cleanNumber(number);
    if (!db.roles.sellers.includes(cleanNum)) {
        db.roles.sellers.push(cleanNum);
        saveDB();
        return true;
    }
    return false;
}

function removeSeller(number) {
    const cleanNum = cleanNumber(number);
    const index = db.roles.sellers.indexOf(cleanNum);
    if (index > -1) {
        db.roles.sellers.splice(index, 1);
        saveDB();
        return true;
    }
    return false;
}

function banUser(number) {
    const cleanNum = cleanNumber(number);
    if (!db.roles.banned.includes(cleanNum)) {
        db.roles.banned.push(cleanNum);
        saveDB();
        return true;
    }
    return false;
}

function unbanUser(number) {
    const cleanNum = cleanNumber(number);
    const index = db.roles.banned.indexOf(cleanNum);
    if (index > -1) {
        db.roles.banned.splice(index, 1);
        saveDB();
        return true;
    }
    return false;
}

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

function addPendingDeposit(userId, username, amount, paymentMethod, sellerId = null) {
    const depositId = generateId();
    const coinAmount = Math.floor(amount / 10000) * config.sellerSettings.coinRate;
    
    const deposit = {
        id: depositId,
        userId: userId,
        username: username,
        amount: amount,
        coinAmount: coinAmount,
        paymentMethod: paymentMethod,
        sellerId: sellerId,
        status: 'pending',
        createdAt: new Date().toISOString(),
        completedAt: null
    };
    
    db.pendingDeposits.push(deposit);
    saveDB();
    return deposit;
}

function approveDeposit(depositId, adminId, adminName) {
    const index = db.pendingDeposits.findIndex(d => d.id === depositId);
    if (index === -1) return null;
    
    const deposit = db.pendingDeposits[index];
    
    if (!db.users[deposit.userId]) {
        db.users[deposit.userId] = {
            userId: deposit.userId,
            username: deposit.username,
            coins: 0,
            gamesPlayed: 0, gamesWon: 0
        };
    }
    
    db.users[deposit.userId].coins += deposit.coinAmount;
    db.users[deposit.userId].totalDeposit = (db.users[deposit.userId].totalDeposit || 0) + deposit.amount;
    
    if (deposit.sellerId && db.roles.sellers.includes(deposit.sellerId)) {
        const commission = Math.floor(deposit.amount * config.sellerSettings.commission / 100);
        if (!db.users[deposit.sellerId]) {
            db.users[deposit.sellerId] = {
                userId: deposit.sellerId,
                username: deposit.sellerId,
                coins: 0,
                gamesPlayed: 0, gamesWon: 0
            };
        }
        db.users[deposit.sellerId].coins += commission;
        db.users[deposit.sellerId].totalCommission = (db.users[deposit.sellerId].totalCommission || 0) + commission;
    }
    
    deposit.status = 'completed';
    deposit.completedAt = new Date().toISOString();
    deposit.approvedBy = adminId;
    deposit.approvedByName = adminName;
    
    db.transactionHistory.push({
        type: 'deposit',
        depositId: depositId,
        userId: deposit.userId,
        username: deposit.username,
        amount: deposit.amount,
        coinAmount: deposit.coinAmount,
        sellerId: deposit.sellerId,
        approvedBy: adminId,
        timestamp: new Date().toISOString()
    });
    
    saveDB();
    return deposit;
}

function rejectDeposit(depositId, adminId, reason) {
    const index = db.pendingDeposits.findIndex(d => d.id === depositId);
    if (index === -1) return null;
    
    const deposit = db.pendingDeposits[index];
    deposit.status = 'rejected';
    deposit.rejectedAt = new Date().toISOString();
    deposit.rejectedBy = adminId;
    deposit.rejectReason = reason;
    
    db.transactionHistory.push({
        type: 'reject',
        depositId: depositId,
        userId: deposit.userId,
        username: deposit.username,
        amount: deposit.amount,
        reason: reason,
        timestamp: new Date().toISOString()
    });
    
    saveDB();
    return deposit;
}

// ==================== BOT START ====================
const activeGames = new Map();
const activePVH = new Map();

async function startBot() {
    console.log('🎮 DUEL RXV TEAMRXVVX WhatsApp Bot starting...');
    console.log('📱 Bot akan menggunakan PAIRING CODE\n');
    console.log(`👑 Owner: ${db.roles.owners.join(', ')}`);
    console.log(`🛒 Seller: ${db.roles.sellers.length} seller terdaftar`);
    console.log(`🚫 Banned: ${db.roles.banned.length} user terban\n`);
    
    const authDir = '/data/auth_info';
    const localAuthDir = './auth_info';
    
    if (!fs.existsSync('/data')) fs.mkdirSync('/data', { recursive: true });
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
    if (!fs.existsSync(localAuthDir)) fs.mkdirSync(localAuthDir, { recursive: true });
    
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['DUEL RXV', 'Chrome', '1.0.0']
    });
    
    sock.ev.on('creds.update', saveCreds);
    
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
                setTimeout(() => startBot(), 5000);
            }
        }
    });
    
    const phoneNumber = config.botNumber;
    console.log(`📱 Menggunakan nomor bot: ${phoneNumber}`);
    console.log('🔐 Meminta kode pairing...\n');
    
    try {
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`\n✅ KODE PAIRING: ${code}`);
        console.log('📱 CARA MENGGUNAKAN:');
        console.log('1. Buka WhatsApp di HP');
        console.log('2. Masuk ke Pengaturan > Perangkat Tertaut');
        console.log('3. Tap "Tautkan Perangkat"');
        console.log(`4. Masukkan kode: ${code}`);
        console.log('\n⏳ Menunggu koneksi...\n');
    } catch (err) {
        console.error('❌ Gagal mendapatkan kode pairing:', err);
        setTimeout(() => startBot(), 5000);
        return;
    }
    
    // MESSAGE HANDLER (disederhanakan untuk menghindari error)
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
            
            // MENU
            if (cmd === 'menu') {
                const isOwnerUser = isOwner(senderId);
                const isSellerUser = isSeller(senderId);
                
                let menu = `🎮 *${config.botName} - MENU UTAMA*\n\n` +
                    `💰 *JACKPOT:* ${formatNumber(db.jackpotPool)} 🪙\n` +
                    `👑 *Role:* ${isOwnerUser ? 'OWNER' : (isSellerUser ? 'SELLER' : 'MEMBER')}\n\n` +
                    
                    `🎲 *GAME HOKI:*\n` +
                    `└ .slot [jumlah] - Slot Machine\n` +
                    `└ .dadu [jumlah] - Dadu Hoki\n` +
                    `└ .kartu [jumlah] - Kartu Hoki\n\n` +
                    
                    `⚔️ *PVP GAMES:*\n` +
                    `└ .reme [jumlah] - Host Reme\n` +
                    `└ .qeme [jumlah] - Host Qeme\n` +
                    `└ .qq [jumlah] - Host QQ\n` +
                    `└ .csn [jumlah] - Host CSN\n` +
                    `└ .btk [jumlah] - Host BTK\n` +
                    `└ .dirt [jumlah] - Host Dirt\n` +
                    `└ .bc [jumlah] - Host BC\n` +
                    `└ .bj [jumlah] - Host BJ\n` +
                    `└ .kb [k/b] [jumlah] - Host KB\n` +
                    `└ .dadu [jumlah] - Host Dadu\n` +
                    `└ .card [jumlah] - Host Card\n` +
                    `└ .flip [jumlah] - Host Flip\n\n` +
                    
                    `🤝 *VS BOT:*\n` +
                    `└ .hleme [jumlah] - Host Leme\n` +
                    `└ .leme [ID] - Join Leme\n` +
                    `└ .hreme [jumlah] - Host Reme\n` +
                    `└ .reme [ID] - Join Reme\n\n` +
                    
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
            
            // HELP
            else if (cmd === 'help') {
                await sock.sendMessage(from, { text: 
                    `📚 *PANDUAN GAME*\n\n` +
                    `🎰 *JUDOL HOKI-HOKIAN:*\n` +
                    `• .slot 1000 - Slot Machine (Jackpot 200x)\n` +
                    `• .dadu 1000 - Dadu Hoki (Jackpot 150x)\n` +
                    `• .kartu 1000 - Kartu Hoki (Jackpot 200x)\n\n` +
                    
                    `⚔️ *PVP:*\n` +
                    `1. Host: .reme 500\n` +
                    `2. Join: .remej ID\n\n` +
                    
                    `🤝 *VS BOT:*\n` +
                    `1. Host: .hleme 500\n` +
                    `2. Join: .leme ID\n\n` +
                    
                    `💰 *DEPOSIT:* ${config.deposit.dana}\n` +
                    `💎 Rate: 10.000 = 1000 coin`
                });
            }
            
            // CEK COIN
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
            
            // LEADERBOARD
            else if (cmd === 'lb') {
                const users = Object.values(db.users).sort((a,b) => b.coins - a.coins).slice(0,10);
                if (users.length === 0) return await sock.sendMessage(from, { text: '❌ Belum ada data' });
                let message = `🏆 *TOP 10 LEADERBOARD*\n\n`;
                for (let i=0; i<users.length; i++) {
                    message += `${i+1}. *${users[i].username}* - ${formatNumber(users[i].coins)} 🪙\n`;
                }
                await sock.sendMessage(from, { text: message });
            }
            
            // SPIN
            else if (cmd === 'spin') {
                const dice = [rollDice(), rollDice(), rollDice()];
                const total = dice[0] + dice[1] + dice[2];
                await sock.sendMessage(from, { text: 
                    `🎲 *SPIN GRATIS*\n${pushName} melempar 3 dadu!\n\n🎲 ${dice[0]} | ${dice[1]} | ${dice[2]} = *${total}*\n\n*Spin ini gratis*`
                });
            }
            
            // DEPOSIT
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
            
            // JACKPOT
            else if (cmd === 'jackpot') {
                await sock.sendMessage(from, { text: 
                    `💰 *JACKPOT POOL*\n💎 Total: ${formatNumber(db.jackpotPool)} coin\n\n` +
                    `🎯 *CARA MENANGKAN:*\n• Main slot/dadu/kartu\n• Dapatkan kombinasi langka\n• 1% chance dapat jackpot`
                });
            }
            
            // DEFAULT
            else {
                await sock.sendMessage(from, { text: `❌ Command tidak dikenal! Ketik .menu untuk bantuan` });
            }
            
        } catch (err) {
            console.error('Error:', err);
        }
    });
    
    // Clean expired games
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
}

// ==================== START ====================
startBot().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

console.log('🎮 DUEL RXV TEAMRXVVX WhatsApp Bot starting...');
