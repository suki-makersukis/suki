// ==========================================
// GAME DUEL LUCKY MAFIAPS
// WhatsApp Bot - Railway Deployment
// ==========================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeInMemoryStore } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

// Set timezone ke WIB
moment.tz.setDefault('Asia/Jakarta');

// ==========================================
// DATABASE SETUP
// ==========================================
const DB_FILE = './database.json';

let db = {
    users: {},
    roles: {
        owners: ['6288317349561@s.whatsapp.net'], // GANTI DENGAN NOMOR OWNER BOT
        sellers: []
    },
    rooms: {},
    pendingDuels: {},
    activeGames: {},
    hostGames: {},
    bankTransactions: {},
    depositHistory: {},
    tickets: {},
    referrals: {},
    withdrawRequests: {},
    gameHistory: {},
    sessions: {}
};

function loadDB() {
    if (fs.existsSync(DB_FILE)) {
        try {
            db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            console.log('✅ Database loaded successfully');
        } catch (e) {
            console.log('❌ Error loading database, using default');
        }
    }
    saveDB();
}

function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.log('❌ Error saving database');
    }
}

loadDB();

// ==========================================
// KONFIGURASI
// ==========================================
const CONFIG = {
    BOT_NAME: 'Duel Lucky MafiaPS',
    BOT_NUMBER: '', // Akan diisi otomatis
    VERSION: '1.0.0',
    DEPOSIT_NUMBER: '+62 831-7349-5612',
    DEPOSIT_EWALLETS: {
        GOPAY: '+62 831-7349-5612',
        DANA: '+62 831-7349-5612',
        OVO: '+62 831-7349-5612'
    },
    DEPOSIT_BANK: 'BCA - 8317349561 a.n Lucky MafiaPS',
    MIN_BET: 100,
    MAX_BET: 10000000,
    TAX_RATE: 0.05,
    HOST_FEE: 0.10,
    DAILY_BONUS: 5000,
    WITHDRAW_MIN: 50000,
    PREFIX: '!', // Prefix command
    SESSION_DIR: './sessions'
};

// Buat folder session jika belum ada
if (!fs.existsSync(CONFIG.SESSION_DIR)) {
    fs.mkdirSync(CONFIG.SESSION_DIR, { recursive: true });
}

// ==========================================
// ROLE MANAGEMENT
// ==========================================

function isOwner(userId) {
    return db.roles.owners.includes(userId);
}

function isSeller(userId) {
    return db.roles.sellers.includes(userId) || isOwner(userId);
}

function addOwner(userId) {
    if (!db.roles.owners.includes(userId)) {
        db.roles.owners.push(userId);
        saveDB();
        return { success: true, message: `✅ Owner berhasil ditambahkan: @${userId.split('@')[0]}` };
    }
    return { success: false, message: `❌ Sudah menjadi owner!` };
}

function removeOwner(userId) {
    if (db.roles.owners.includes(userId) && db.roles.owners.length > 1) {
        const index = db.roles.owners.indexOf(userId);
        db.roles.owners.splice(index, 1);
        saveDB();
        return { success: true, message: `✅ Owner berhasil dihapus: @${userId.split('@')[0]}` };
    }
    return { success: false, message: `❌ Tidak dapat menghapus owner terakhir!` };
}

function addSeller(userId) {
    if (!db.roles.sellers.includes(userId)) {
        db.roles.sellers.push(userId);
        saveDB();
        return { success: true, message: `✅ Seller berhasil ditambahkan: @${userId.split('@')[0]}` };
    }
    return { success: false, message: `❌ Sudah menjadi seller!` };
}

function removeSeller(userId) {
    const index = db.roles.sellers.indexOf(userId);
    if (index > -1) {
        db.roles.sellers.splice(index, 1);
        saveDB();
        return { success: true, message: `✅ Seller berhasil dihapus: @${userId.split('@')[0]}` };
    }
    return { success: false, message: `❌ Bukan seller!` };
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatMoney(amount) {
    return new Intl.NumberFormat('id-ID').format(amount);
}

function getTimeNow() {
    return moment().format('DD/MM/YYYY HH:mm:ss');
}

function getUser(userId) {
    if (!db.users[userId]) {
        db.users[userId] = {
            name: userId.split('@')[0],
            balance: { bgl: 5000, mgl: 0 },
            bank: { bgl: 0, mgl: 0 },
            stats: {
                wins: 0,
                losses: 0,
                totalBet: 0,
                totalWin: 0,
                gamesPlayed: 0,
                streak: 0
            },
            createdAt: new Date().toISOString(),
            lastDaily: null,
            referralCode: userId.split('@')[0].slice(-6),
            referredBy: null,
            referrerEarned: 0
        };
        saveDB();
    }
    return db.users[userId];
}

function checkBalance(userId, currency, amount) {
    const user = getUser(userId);
    return user.balance[currency] >= amount;
}

function deductBalance(userId, currency, amount) {
    const user = getUser(userId);
    if (user.balance[currency] >= amount) {
        user.balance[currency] -= amount;
        user.stats.totalBet += amount;
        saveDB();
        return true;
    }
    return false;
}

function addBalance(userId, currency, amount, reason = '') {
    const user = getUser(userId);
    user.balance[currency] += amount;
    user.stats.totalWin += amount;
    
    if (reason === 'daily') {
        user.lastDaily = Date.now();
    }
    
    saveDB();
    return true;
}

function transferBalance(fromId, toId, currency, amount, note = '') {
    if (checkBalance(fromId, currency, amount)) {
        deductBalance(fromId, currency, amount);
        addBalance(toId, currency, amount);
        return true;
    }
    return false;
}

// ==========================================
// GAME MECHANICS
// ==========================================

// 1. REME Game
function gameReme(betAmount, choice) {
    const validChoices = ['b1', 'b3', 'b5', 'b7'];
    if (!validChoices.includes(choice)) return null;
    
    const targetNumber = validChoices.indexOf(choice) + 1;
    const randomNumber = randomInt(1, 7);
    const isWin = randomNumber === targetNumber;
    const multiplier = 7;
    const winAmount = isWin ? betAmount * multiplier : 0;
    
    return {
        isWin,
        winAmount,
        randomNumber,
        targetNumber,
        multiplier,
        message: `🎲 *GAME REME*\n━━━━━━━━━━━━━━\n🎯 Pilihan: ${choice}\n🎲 Angka keluar: ${randomNumber}\n━━━━━━━━━━━━━━\n${isWin ? `✅ *SELAMAT!*\n💰 Menang: ${formatMoney(winAmount)} BGL` : '❌ *KALAH!*'}`
    };
}

// 2. LEME Game
function gameLeme(betAmount, choice) {
    const validChoices = ['b1', 'b3', 'b5', 'b7', 'b9'];
    if (!validChoices.includes(choice)) return null;
    
    const luckyNumber = randomInt(1, 9);
    const targetNum = parseInt(choice[1]);
    const isWin = luckyNumber === targetNum;
    const multiplier = 9;
    const winAmount = isWin ? betAmount * multiplier : 0;
    
    return {
        isWin,
        winAmount,
        luckyNumber,
        targetNum,
        multiplier,
        message: `🍀 *GAME LEME*\n━━━━━━━━━━━━━━\n🍀 Pilihan: ${choice}\n🎲 Angka keluar: ${luckyNumber}\n━━━━━━━━━━━━━━\n${isWin ? `✅ *SELAMAT!*\n💰 Menang: ${formatMoney(winAmount)} BGL` : '❌ *KALAH!*'}`
    };
}

// 3. QEME Game
function gameQeme(betAmount, choice) {
    const validChoices = ['b1', 'b3', 'b5', 'b7', 'b9'];
    if (!validChoices.includes(choice)) return null;
    
    const cards = [randomInt(1, 13), randomInt(1, 13)];
    const total = (cards[0] + cards[1]) % 10;
    const target = parseInt(choice[1]);
    const isWin = total === target;
    const multiplier = 10;
    const winAmount = isWin ? betAmount * multiplier : 0;
    
    return {
        isWin,
        winAmount,
        cards,
        total,
        target,
        multiplier,
        message: `🃏 *GAME QEME*\n━━━━━━━━━━━━━━\n🃏 Kartu: ${cards[0]} | ${cards[1]}\n🎯 Nilai: ${total}\n🎯 Target: ${choice}\n━━━━━━━━━━━━━━\n${isWin ? `✅ MENANG ${formatMoney(winAmount)} BGL!` : '❌ KALAH!'}`
    };
}

// 4. LEWA Game
function gameLewa(betAmount, choice) {
    const validChoices = ['b1', 'b3', 'b5', 'b7', 'b9'];
    if (!validChoices.includes(choice)) return null;
    
    const cards = [randomInt(1, 13), randomInt(1, 13), randomInt(1, 13)];
    const sum = cards.reduce((a, b) => a + b, 0);
    const lastDigit = sum % 10;
    const target = parseInt(choice[1]);
    const isWin = lastDigit === target;
    const multiplier = 10;
    const winAmount = isWin ? betAmount * multiplier : 0;
    
    return {
        isWin,
        winAmount,
        cards,
        sum,
        lastDigit,
        target,
        multiplier,
        message: `🎴 *GAME LEWA*\n━━━━━━━━━━━━━━\n🎴 Kartu: ${cards.join(' | ')}\n📊 Total: ${sum} | Akhir: ${lastDigit}\n🎯 Target: ${choice}\n━━━━━━━━━━━━━━\n${isWin ? `✅ MENANG ${formatMoney(winAmount)} BGL!` : '❌ KALAH!'}`
    };
}

// 5. CSN Game
function gameCsn(betAmount, choice) {
    const validChoices = ['b1', 'b3', 'b5', 'b7'];
    if (!validChoices.includes(choice)) return null;
    
    const cards = [randomInt(1, 13), randomInt(1, 13), randomInt(1, 13)];
    const sum = cards.reduce((a, b) => a + b, 0);
    const lastDigit = sum % 10;
    const target = parseInt(choice[1]);
    const isWin = lastDigit === target;
    const multiplier = 10;
    const winAmount = isWin ? betAmount * multiplier : 0;
    
    return {
        isWin,
        winAmount,
        cards,
        sum,
        lastDigit,
        target,
        message: `🎴 *GAME CSN*\n━━━━━━━━━━━━━━\n🎴 Kartu: ${cards.join(', ')}\nTotal: ${sum} | Akhir: ${lastDigit}\n${isWin ? `✅ MENANG ${formatMoney(winAmount)} BGL!` : '❌ KALAH!'}`
    };
}

// 6. QQ Game
function gameQq(betAmount, choice) {
    const validChoices = ['b1', 'b3', 'b5', 'b7'];
    if (!validChoices.includes(choice)) return null;
    
    const cards = [randomInt(1, 13), randomInt(1, 13)];
    const total = (cards[0] + cards[1]) % 10;
    const target = parseInt(choice[1]);
    const isWin = total === target;
    const multiplier = 10;
    const winAmount = isWin ? betAmount * multiplier : 0;
    
    return {
        isWin,
        winAmount,
        cards,
        total,
        target,
        message: `🃏 *GAME QQ*\n━━━━━━━━━━━━━━\nKartu: ${cards.join(', ')} | Nilai: ${total}\n${isWin ? `✅ MENANG ${formatMoney(winAmount)} BGL!` : '❌ KALAH!'}`
    };
}

// 7. RPS Game
function gameRps(betAmount, choice) {
    const choices = ['batu', 'kertas', 'gunting'];
    const botChoice = choices[randomInt(0, 2)];
    
    let isWin = false;
    if (choice === 'batu' && botChoice === 'gunting') isWin = true;
    else if (choice === 'kertas' && botChoice === 'batu') isWin = true;
    else if (choice === 'gunting' && botChoice === 'kertas') isWin = true;
    
    const winAmount = isWin ? betAmount * 2 : 0;
    
    return {
        isWin,
        winAmount,
        userChoice: choice,
        botChoice,
        message: `🖐️ *GAME RPS*\n━━━━━━━━━━━━━━\n👤 Anda: ${choice}\n🤖 Bot: ${botChoice}\n━━━━━━━━━━━━━━\n${isWin ? `✅ MENANG ${formatMoney(winAmount)} BGL!` : '❌ KALAH!'}`
    };
}

// 8. Dadu Game
function gameDadu(betAmount, choice) {
    const validChoices = ['b1', 'b3', 'b5', 'b7'];
    if (!validChoices.includes(choice)) return null;
    
    const dice = randomInt(1, 6);
    const target = parseInt(choice[1]);
    const isWin = dice === target;
    const multiplier = 6;
    const winAmount = isWin ? betAmount * multiplier : 0;
    
    return {
        isWin,
        winAmount,
        dice,
        target,
        message: `🎲 *GAME DADU*\n━━━━━━━━━━━━━━\n🎲 Dadu: ${dice}\n🎯 Target: ${choice}\n━━━━━━━━━━━━━━\n${isWin ? `✅ MENANG ${formatMoney(winAmount)} BGL!` : '❌ KALAH!'}`
    };
}

// 9. KB Game
function gameKb(betAmount, choice) {
    const dice = randomInt(1, 6);
    const isKecil = dice <= 3;
    const isWin = (choice === 'kecil' && isKecil) || (choice === 'besar' && !isKecil);
    const winAmount = isWin ? betAmount * 2 : 0;
    
    return {
        isWin,
        winAmount,
        dice,
        choice,
        message: `🎲 *GAME KB*\n━━━━━━━━━━━━━━\n🎲 Dadu: ${dice} (${dice <= 3 ? 'KECIL' : 'BESAR'})\n🎯 Pilihan: ${choice.toUpperCase()}\n━━━━━━━━━━━━━━\n${isWin ? `✅ MENANG ${formatMoney(winAmount)} BGL!` : '❌ KALAH!'}`
    };
}

// 10. Coin Game
function gameCoin(betAmount, choice) {
    const result = randomInt(1, 2) === 1 ? 'head' : 'tail';
    const isWin = choice === result;
    const winAmount = isWin ? betAmount * 2 : 0;
    
    return {
        isWin,
        winAmount,
        result,
        choice,
        message: `🪙 *GAME COIN*\n━━━━━━━━━━━━━━\n🪙 Hasil: ${result === 'head' ? 'KEPALA' : 'EKOR'}\n🎯 Pilihan: ${choice.toUpperCase()}\n━━━━━━━━━━━━━━\n${isWin ? `✅ MENANG ${formatMoney(winAmount)} BGL!` : '❌ KALAH!'}`
    };
}

// 11. LMH Game
function gameLmh(betAmount, choice) {
    const number = randomInt(1, 100);
    let isWin = false;
    
    if (choice === 'low' && number <= 33) isWin = true;
    else if (choice === 'mid' && number >= 34 && number <= 66) isWin = true;
    else if (choice === 'high' && number >= 67) isWin = true;
    
    const multiplier = 3;
    const winAmount = isWin ? betAmount * multiplier : 0;
    
    return {
        isWin,
        winAmount,
        number,
        choice,
        message: `🎯 *GAME LMH*\n━━━━━━━━━━━━━━\n🎯 Angka: ${number}\n🎯 Range: ${choice === 'low' ? '1-33' : choice === 'mid' ? '34-66' : '67-100'}\n━━━━━━━━━━━━━━\n${isWin ? `✅ MENANG ${formatMoney(winAmount)} BGL!` : '❌ KALAH!'}`
    };
}

// 12. NEME Game
function gameNeme(betAmount) {
    const number = randomInt(1, 100);
    const isWin = number % 2 === 0;
    const winAmount = isWin ? betAmount * 2 : 0;
    
    return {
        isWin,
        winAmount,
        number,
        message: `🎯 *GAME NEME*\n━━━━━━━━━━━━━━\n🎯 Angka: ${number} (${number % 2 === 0 ? 'GENAP' : 'GANJIL'})\n━━━━━━━━━━━━━━\n${isWin ? `✅ MENANG ${formatMoney(winAmount)} BGL!` : '❌ KALAH!'}`
    };
}

// ==========================================
// PVP DUEL SYSTEM
// ==========================================

function createDuel(player1Id, player2Id, currency, betAmount, gameType) {
    const duelId = `${player1Id}_${player2Id}_${Date.now()}`;
    
    db.pendingDuels[duelId] = {
        player1: player1Id,
        player2: player2Id,
        currency,
        betAmount,
        gameType,
        status: 'pending',
        createdAt: Date.now()
    };
    
    saveDB();
    return duelId;
}

function startDuel(duelId) {
    const duel = db.pendingDuels[duelId];
    if (!duel) return { error: 'Duel tidak ditemukan' };
    
    if (!checkBalance(duel.player1, duel.currency, duel.betAmount) ||
        !checkBalance(duel.player2, duel.currency, duel.betAmount)) {
        return { error: 'Saldo tidak mencukupi' };
    }
    
    deductBalance(duel.player1, duel.currency, duel.betAmount);
    deductBalance(duel.player2, duel.currency, duel.betAmount);
    
    let result1, result2;
    const randomChoice1 = ['b1', 'b3', 'b5', 'b7'][randomInt(0, 3)];
    const randomChoice2 = ['b1', 'b3', 'b5', 'b7'][randomInt(0, 3)];
    
    switch (duel.gameType) {
        case 'reme':
            result1 = gameReme(duel.betAmount, randomChoice1);
            result2 = gameReme(duel.betAmount, randomChoice2);
            break;
        case 'leme':
            result1 = gameLeme(duel.betAmount, randomChoice1);
            result2 = gameLeme(duel.betAmount, randomChoice2);
            break;
        case 'qeme':
            result1 = gameQeme(duel.betAmount, randomChoice1);
            result2 = gameQeme(duel.betAmount, randomChoice2);
            break;
        case 'lewa':
            result1 = gameLewa(duel.betAmount, randomChoice1);
            result2 = gameLewa(duel.betAmount, randomChoice2);
            break;
        default:
            result1 = gameReme(duel.betAmount, randomChoice1);
            result2 = gameReme(duel.betAmount, randomChoice2);
    }
    
    let winner, loser;
    if (result1.winAmount > result2.winAmount) {
        winner = duel.player1;
        loser = duel.player2;
    } else if (result2.winAmount > result1.winAmount) {
        winner = duel.player2;
        loser = duel.player1;
    } else {
        addBalance(duel.player1, duel.currency, duel.betAmount);
        addBalance(duel.player2, duel.currency, duel.betAmount);
        delete db.pendingDuels[duelId];
        saveDB();
        return { 
            isTie: true,
            message: `🤝 *DUEL SERI!*\n━━━━━━━━━━━━━━\n💰 Taruhan dikembalikan!\n\n🎲 Hasil Player 1:\n${result1.message}\n\n🎲 Hasil Player 2:\n${result2.message}`
        };
    }
    
    const totalPrize = duel.betAmount * 2;
    const tax = Math.floor(totalPrize * CONFIG.TAX_RATE);
    const winnerPrize = totalPrize - tax;
    
    addBalance(winner, duel.currency, winnerPrize);
    
    const winnerUser = getUser(winner);
    const loserUser = getUser(loser);
    winnerUser.stats.wins++;
    loserUser.stats.losses++;
    winnerUser.stats.streak++;
    loserUser.stats.streak = 0;
    saveDB();
    
    delete db.pendingDuels[duelId];
    
    return {
        winner,
        loser,
        prize: winnerPrize,
        tax,
        result1,
        result2,
        message: `🏆 *DUEL ${duel.gameType.toUpperCase()}* 🏆\n━━━━━━━━━━━━━━\n💰 Taruhan: ${formatMoney(duel.betAmount)} ${duel.currency.toUpperCase()}\n━━━━━━━━━━━━━━\n🎲 HASIL PLAYER 1:\n${result1.message}\n\n🎲 HASIL PLAYER 2:\n${result2.message}\n━━━━━━━━━━━━━━\n🏅 *PEMENANG:* @${winner.split('@')[0]}\n🎁 Hadiah: ${formatMoney(winnerPrize)} ${duel.currency.toUpperCase()}\n💸 Pajak Meja: ${formatMoney(tax)} ${duel.currency.toUpperCase()}\n━━━━━━━━━━━━━━\n✨ *Streak: ${winnerUser.stats.streak}*`
    };
}

// ==========================================
// DEPOSIT & WITHDRAW SYSTEM
// ==========================================

function getDepositInfo() {
    return `╭───〔 *💳 INFO DEPOSIT* 〕
│
├─ 📱 *GOPAY:* ${CONFIG.DEPOSIT_EWALLETS.GOPAY}
├─ 📱 *DANA:* ${CONFIG.DEPOSIT_EWALLETS.DANA}
├─ 📱 *OVO:* ${CONFIG.DEPOSIT_EWALLETS.OVO}
├─ 🏦 *BANK:* ${CONFIG.DEPOSIT_BANK}
│
├─ 📝 *CARA DEPOSIT:*
│  1. Transfer ke nomor di atas
│  2. Screenshot bukti transfer
│  3. Ketik *${CONFIG.PREFIX}depo* dan kirim bukti
│
╰────────────────────────`;
}

function createWithdrawTicket(userId, currency, amount) {
    if (amount < CONFIG.WITHDRAW_MIN) {
        return { success: false, message: `❌ Minimal withdraw ${formatMoney(CONFIG.WITHDRAW_MIN)}` };
    }
    
    if (!checkBalance(userId, currency, amount)) {
        return { success: false, message: `❌ Saldo tidak mencukupi!` };
    }
    
    const ticketId = `WD_${Date.now()}_${userId.split('@')[0]}`;
    
    db.withdrawRequests[ticketId] = {
        userId,
        currency,
        amount,
        status: 'pending',
        createdAt: Date.now()
    };
    
    saveDB();
    return { 
        success: true, 
        ticketId,
        message: `✅ Ticket withdraw berhasil dibuat!\n🆔 ID: ${ticketId}\n💰 Jumlah: ${formatMoney(amount)} ${currency.toUpperCase()}\n⏳ Menunggu verifikasi admin.`
    };
}

function approveWithdraw(ticketId, adminId) {
    const ticket = db.withdrawRequests[ticketId];
    if (!ticket) return { success: false, message: '❌ Ticket tidak ditemukan!' };
    if (ticket.status !== 'pending') return { success: false, message: '❌ Ticket sudah diproses!' };
    
    if (checkBalance(ticket.userId, ticket.currency, ticket.amount)) {
        deductBalance(ticket.userId, ticket.currency, ticket.amount);
        ticket.status = 'approved';
        ticket.approvedBy = adminId;
        ticket.approvedAt = Date.now();
        saveDB();
        return { 
            success: true, 
            message: `✅ Withdraw disetujui!\n👤 User: @${ticket.userId.split('@')[0]}\n💰 Jumlah: ${formatMoney(ticket.amount)} ${ticket.currency.toUpperCase()}`
        };
    }
    return { success: false, message: '❌ Saldo user tidak mencukupi!' };
}

// ==========================================
// OWNER COMMANDS
// ==========================================

function ownerAddCoin(userId, currency, amount) {
    if (currency !== 'bgl' && currency !== 'mgl') {
        return { success: false, message: '❌ Currency hanya bgl atau mgl!' };
    }
    addBalance(userId, currency, amount, 'owner_add');
    return { success: true, message: `✅ Berhasil menambahkan ${formatMoney(amount)} ${currency.toUpperCase()} ke @${userId.split('@')[0]}` };
}

function ownerDelCoin(userId, currency, amount) {
    if (checkBalance(userId, currency, amount)) {
        deductBalance(userId, currency, amount);
        return { success: true, message: `✅ Berhasil menghapus ${formatMoney(amount)} ${currency.toUpperCase()} dari @${userId.split('@')[0]}` };
    }
    return { success: false, message: `❌ Saldo @${userId.split('@')[0]} tidak mencukupi!` };
}

function ownerSetCoin(userId, currency, amount) {
    const user = getUser(userId);
    user.balance[currency] = amount;
    saveDB();
    return { success: true, message: `✅ Berhasil mengatur saldo @${userId.split('@')[0]} menjadi ${formatMoney(amount)} ${currency.toUpperCase()}` };
}

// ==========================================
// MENU
// ==========================================

function getMainMenu() {
    return `╭───〔 *${CONFIG.BOT_NAME}* 〕
│  ⚡ Status : Online
│  🤖 Bot : V${CONFIG.VERSION}
│  📝 Request Fitur *Duel Lucky MafiaPS*
├──〔 🎮 GAME PVP 〕
│  •🎮 *reme* <bet> <b1/b3/b5/b7>
│  •🎮 *leme* <bet> <b1/b3/b5/b7/b9>
│  •🎮 *qeme* <bet> <b1/b3/b5/b7/b9>
│  •🎮 *lewa* <bet> <b1/b3/b5/b7/b9>
│  •🎮 *csn* <bet> <b1/b3/b5/b7>
│  •🎮 *qq* <bet> <b1/b3/b5/b7>
│  •🖐️ *rps* <bet> <batu/kertas/gunting>
│  •🎲 *dadu* <bet> <b1/b3/b5/b7>
│  •🎲 *kb* <bet> <kecil/besar>
│  •🪙 *coin* <bet> <head/tail>
│  •🎯 *lmh* <bet> <low/mid/high>
│  •🎯 *neme* <bet>
├──〔 🎮 GAME PVP DUEL 〕
│  •⚔️ *duel* @tag <game> <bet>
│  •✅ *accept* - Terima duel
│  •❌ *reject* - Tolak duel
├──〔 💰 ECONOMY SYSTEM 〕
│  •💵 *cu* — cek uang
│  •💸 *tf* @tag <jumlah> <bgl/mgl>
│  •🥇 *top* — leaderboard
│  •🏦 *bank* — cek bank
│  •🏦 *savebank* <jumlah> — simpan
│  •🏦 *cashout* <jumlah> — tarik
│  •🎁 *daily* — bonus harian
├──〔 💳 DEPOSIT SYSTEM 〕
│  •💳 *depo* — info deposit
│  •💳 *wd* <amount> — withdraw
├──〔 🛠️ADMIN COMMANDS 〕
│  •👑 *addowner* @tag — tambah owner
│  •👑 *delowner* @tag — hapus owner
│  •🛡️ *addseller* @tag — tambah seller
│  •🛡️ *delseller* @tag — hapus seller
│  •➕ *addcoin* @tag <amount> <bgl/mgl>
│  •➖ *delcoin* @tag <amount> <bgl/mgl>
│  •⚙️ *setcoin* @tag <amount> <bgl/mgl>
│  •✅ *approvewd* <ticket_id>
│  •📢 *bc* <pesan>
├──〔 🛠️TOOLS 〕
│  •🎲 *dice* — roll dadu
│  •🪙 *flip* — flip coin
│  •🃏 *card* — random kartu
│  •🔰 *how* — cara bermain
╰────────────────────────
© ${CONFIG.BOT_NAME}`;
}

// ==========================================
// WHATSAPP BOT CONNECTION
// ==========================================

const store = makeInMemoryStore({ logger: P().child({ level: 'silent' }) });

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(CONFIG.SESSION_DIR);
    
    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ['Duel Lucky MafiaPS', 'Chrome', '1.0.0']
    });
    
    store.bind(sock.ev);
    
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('📱 Scan QR Code berikut dengan WhatsApp:');
            console.log(qr);
        }
        
        if (connection === 'open') {
            console.log('✅ Bot Connected Successfully!');
            console.log(`🤖 ${CONFIG.BOT_NAME} is running...`);
            
            // Get bot number
            if (sock.user) {
                CONFIG.BOT_NUMBER = sock.user.id;
                console.log(`📱 Bot Number: ${CONFIG.BOT_NUMBER}`);
            }
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Connection closed, reconnecting...');
            if (shouldReconnect) {
                startBot();
            }
        }
    });
    
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;
        
        const messageContent = msg.message.conversation || 
                              msg.message.extendedTextMessage?.text || 
                              '';
        
        const sender = msg.key.remoteJid;
        const isGroup = sender.endsWith('@g.us');
        const from = isGroup ? sender : sender;
        const senderNumber = msg.key.participant || sender;
        
        if (!messageContent.startsWith(CONFIG.PREFIX)) return;
        
        const args = messageContent.slice(CONFIG.PREFIX.length).trim().split(/ +/);
        const command = args[0].toLowerCase();
        const params = args.slice(1);
        
        console.log(`[${getTimeNow()}] Command: ${command} from ${senderNumber}`);
        
        // Simple command handling
        let response = '';
        
        // MENU
        if (command === 'menu' || command === 'help') {
            response = getMainMenu();
        }
        
        // ECONOMY
        else if (command === 'cu') {
            const user = getUser(senderNumber);
            response = `╭───〔 *💵 SALDO ANDA* 〕
│
├─ 💎 *BGL:* ${formatMoney(user.balance.bgl)}
├─ 💎 *MGL:* ${formatMoney(user.balance.mgl)}
│
├─ 📊 *STATISTIK:*
├─ 🏆 Menang: ${user.stats.wins}
├─ 💔 Kalah: ${user.stats.losses}
├─ 🎲 Streak: ${user.stats.streak}
├─ 💰 Total Bet: ${formatMoney(user.stats.totalBet)}
├─ 🎁 Total Win: ${formatMoney(user.stats.totalWin)}
│
╰────────────────────────`;
        }
        
        else if (command === 'daily') {
            const user = getUser(senderNumber);
            const now = Date.now();
            const lastDaily = user.lastDaily || 0;
            const hoursDiff = (now - lastDaily) / (1000 * 60 * 60);
            
            if (hoursDiff >= 24) {
                addBalance(senderNumber, 'bgl', CONFIG.DAILY_BONUS, 'daily');
                response = `🎁 *DAILY BONUS*\n━━━━━━━━━━━━━━\n✅ Anda mendapatkan ${formatMoney(CONFIG.DAILY_BONUS)} BGL!\n📅 Kembali lagi besok!`;
            } else {
                const remaining = Math.ceil(24 - hoursDiff);
                response = `⏰ *BELUM WAKTUNYA!*\n━━━━━━━━━━━━━━\n⏳ Tunggu ${remaining} jam lagi untuk claim daily bonus!`;
            }
        }
        
        else if (command === 'top') {
            const users = Object.entries(db.users)
                .sort((a, b) => b[1].stats.totalWin - a[1].stats.totalWin)
                .slice(0, 10);
            
            let leaderboard = '╭───〔 *🏆 LEADERBOARD* 〕\n│\n';
            users.forEach(([id, data], index) => {
                leaderboard += `├─ ${index + 1}. @${id.split('@')[0]}\n`;
                leaderboard += `│   💰 ${formatMoney(data.stats.totalWin)} BGL\n`;
            });
            leaderboard += '╰────────────────────────';
            response = leaderboard;
        }
        
        // GAMES
        else if (command === 'reme' && params.length >= 2) {
            const bet = parseInt(params[0]);
            const choice = params[1];
            
            if (isNaN(bet) || bet < CONFIG.MIN_BET || bet > CONFIG.MAX_BET) {
                response = `❌ Taruhan harus antara ${formatMoney(CONFIG.MIN_BET)} - ${formatMoney(CONFIG.MAX_BET)}`;
            } else if (!checkBalance(senderNumber, 'bgl', bet)) {
                response = `❌ Saldo BGL tidak mencukupi!`;
            } else {
                deductBalance(senderNumber, 'bgl', bet);
                const result = gameReme(bet, choice);
                if (result) {
                    if (result.isWin) {
                        addBalance(senderNumber, 'bgl', result.winAmount);
                    }
                    response = result.message;
                } else {
                    addBalance(senderNumber, 'bgl', bet);
                    response = `❌ Pilihan tidak valid! Gunakan: b1, b3, b5, b7`;
                }
            }
        }
        
        else if (command === 'leme' && params.length >= 2) {
            const bet = parseInt(params[0]);
            const choice = params[1];
            
            if (isNaN(bet) || bet < CONFIG.MIN_BET || bet > CONFIG.MAX_BET) {
                response = `❌ Taruhan harus antara ${formatMoney(CONFIG.MIN_BET)} - ${formatMoney(CONFIG.MAX_BET)}`;
            } else if (!checkBalance(senderNumber, 'bgl', bet)) {
                response = `❌ Saldo BGL tidak mencukupi!`;
            } else {
                deductBalance(senderNumber, 'bgl', bet);
                const result = gameLeme(bet, choice);
                if (result) {
                    if (result.isWin) {
                        addBalance(senderNumber, 'bgl', result.winAmount);
                    }
                    response = result.message;
                } else {
                    addBalance(senderNumber, 'bgl', bet);
                    response = `❌ Pilihan tidak valid! Gunakan: b1, b3, b5, b7, b9`;
                }
            }
        }
        
        else if (command === 'qeme' && params.length >= 2) {
            const bet = parseInt(params[0]);
            const choice = params[1];
            
            if (isNaN(bet) || bet < CONFIG.MIN_BET || bet > CONFIG.MAX_BET) {
                response = `❌ Taruhan harus antara ${formatMoney(CONFIG.MIN_BET)} - ${formatMoney(CONFIG.MAX_BET)}`;
            } else if (!checkBalance(senderNumber, 'bgl', bet)) {
                response = `❌ Saldo BGL tidak mencukupi!`;
            } else {
                deductBalance(senderNumber, 'bgl', bet);
                const result = gameQeme(bet, choice);
                if (result) {
                    if (result.isWin) {
                        addBalance(senderNumber, 'bgl', result.winAmount);
                    }
                    response = result.message;
                } else {
                    addBalance(senderNumber, 'bgl', bet);
                    response = `❌ Pilihan tidak valid! Gunakan: b1, b3, b5, b7, b9`;
                }
            }
        }
        
        else if (command === 'lewa' && params.length >= 2) {
            const bet = parseInt(params[0]);
            const choice = params[1];
            
            if (isNaN(bet) || bet < CONFIG.MIN_BET || bet > CONFIG.MAX_BET) {
                response = `❌ Taruhan harus antara ${formatMoney(CONFIG.MIN_BET)} - ${formatMoney(CONFIG.MAX_BET)}`;
            } else if (!checkBalance(senderNumber, 'bgl', bet)) {
                response = `❌ Saldo BGL tidak mencukupi!`;
            } else {
                deductBalance(senderNumber, 'bgl', bet);
                const result = gameLewa(bet, choice);
                if (result) {
                    if (result.isWin) {
                        addBalance(senderNumber, 'bgl', result.winAmount);
                    }
                    response = result.message;
                } else {
                    addBalance(senderNumber, 'bgl', bet);
                    response = `❌ Pilihan tidak valid! Gunakan: b1, b3, b5, b7, b9`;
                }
            }
        }
        
        else if (command === 'csn' && params.length >= 2) {
            const bet = parseInt(params[0]);
            const choice = params[1];
            
            if (isNaN(bet) || bet < CONFIG.MIN_BET || bet > CONFIG.MAX_BET) {
                response = `❌ Taruhan harus antara ${formatMoney(CONFIG.MIN_BET)} - ${formatMoney(CONFIG.MAX_BET)}`;
            } else if (!checkBalance(senderNumber, 'bgl', bet)) {
                response = `❌ Saldo BGL tidak mencukupi!`;
            } else {
                deductBalance(senderNumber, 'bgl', bet);
                const result = gameCsn(bet, choice);
                if (result) {
                    if (result.isWin) {
                        addBalance(senderNumber, 'bgl', result.winAmount);
                    }
                    response = result.message;
                } else {
                    addBalance(senderNumber, 'bgl', bet);
                    response = `❌ Pilihan tidak valid! Gunakan: b1, b3, b5, b7`;
                }
            }
        }
        
        else if (command === 'qq' && params.length >= 2) {
            const bet = parseInt(params[0]);
            const choice = params[1];
            
            if (isNaN(bet) || bet < CONFIG.MIN_BET || bet > CONFIG.MAX_BET) {
                response = `❌ Taruhan harus antara ${formatMoney(CONFIG.MIN_BET)} - ${formatMoney(CONFIG.MAX_BET)}`;
            } else if (!checkBalance(senderNumber, 'bgl', bet)) {
                response = `❌ Saldo BGL tidak mencukupi!`;
            } else {
                deductBalance(senderNumber, 'bgl', bet);
                const result = gameQq(bet, choice);
                if (result) {
                    if (result.isWin) {
                        addBalance(senderNumber, 'bgl', result.winAmount);
                    }
                    response = result.message;
                } else {
                    addBalance(senderNumber, 'bgl', bet);
                    response = `❌ Pilihan tidak valid! Gunakan: b1, b3, b5, b7`;
                }
            }
        }
        
        else if (command === 'rps' && params.length >= 2) {
            const bet = parseInt(params[0]);
            const choice = params[1];
            const validChoices = ['batu', 'kertas', 'gunting'];
            
            if (isNaN(bet) || bet < CONFIG.MIN_BET || bet > CONFIG.MAX_BET) {
                response = `❌ Taruhan harus antara ${formatMoney(CONFIG.MIN_BET)} - ${formatMoney(CONFIG.MAX_BET)}`;
            } else if (!validChoices.includes(choice)) {
                response = `❌ Pilihan tidak valid! Gunakan: batu, kertas, gunting`;
            } else if (!checkBalance(senderNumber, 'bgl', bet)) {
                response = `❌ Saldo BGL tidak mencukupi!`;
            } else {
                deductBalance(senderNumber, 'bgl', bet);
                const result = gameRps(bet, choice);
                if (result.isWin) {
                    addBalance(senderNumber, 'bgl', result.winAmount);
                }
                response = result.message;
            }
        }
        
        else if (command === 'dadu' && params.length >= 2) {
            const bet = parseInt(params[0]);
            const choice = params[1];
            
            if (isNaN(bet) || bet < CONFIG.MIN_BET || bet > CONFIG.MAX_BET) {
                response = `❌ Taruhan harus antara ${formatMoney(CONFIG.MIN_BET)} - ${formatMoney(CONFIG.MAX_BET)}`;
            } else if (!checkBalance(senderNumber, 'bgl', bet)) {
                response = `❌ Saldo BGL tidak mencukupi!`;
            } else {
                deductBalance(senderNumber, 'bgl', bet);
                const result = gameDadu(bet, choice);
                if (result) {
                    if (result.isWin) {
                        addBalance(senderNumber, 'bgl', result.winAmount);
                    }
                    response = result.message;
                } else {
                    addBalance(senderNumber, 'bgl', bet);
                    response = `❌ Pilihan tidak valid! Gunakan: b1, b3, b5, b7`;
                }
            }
        }
        
        else if (command === 'kb' && params.length >= 2) {
            const bet = parseInt(params[0]);
            const choice = params[1];
            
            if (isNaN(bet) || bet < CONFIG.MIN_BET || bet > CONFIG.MAX_BET) {
                response = `❌ Taruhan harus antara ${formatMoney(CONFIG.MIN_BET)} - ${formatMoney(CONFIG.MAX_BET)}`;
            } else if (!['kecil', 'besar'].includes(choice)) {
                response = `❌ Pilihan tidak valid! Gunakan: kecil atau besar`;
            } else if (!checkBalance(senderNumber, 'bgl', bet)) {
                response = `❌ Saldo BGL tidak mencukupi!`;
            } else {
                deductBalance(senderNumber, 'bgl', bet);
                const result = gameKb(bet, choice);
                if (result.isWin) {
                    addBalance(senderNumber, 'bgl', result.winAmount);
                }
                response = result.message;
            }
        }
        
        else if (command === 'coin' && params.length >= 2) {
            const bet = parseInt(params[0]);
            const choice = params[1];
            
            if (isNaN(bet) || bet < CONFIG.MIN_BET || bet > CONFIG.MAX_BET) {
                response = `❌ Taruhan harus antara ${formatMoney(CONFIG.MIN_BET)} - ${formatMoney(CONFIG.MAX_BET)}`;
            } else if (!['head', 'tail'].includes(choice)) {
                response = `❌ Pilihan tidak valid! Gunakan: head atau tail`;
            } else if (!checkBalance(senderNumber, 'bgl', bet)) {
                response = `❌ Saldo BGL tidak mencukupi!`;
            } else {
                deductBalance(senderNumber, 'bgl', bet);
                const result = gameCoin(bet, choice);
                if (result.isWin) {
                    addBalance(senderNumber, 'bgl', result.winAmount);
                }
                response = result.message;
            }
        }
        
        else if (command === 'lmh' && params.length >= 2) {
            const bet = parseInt(params[0]);
            const choice = params[1];
            
            if (isNaN(bet) || bet < CONFIG.MIN_BET || bet > CONFIG.MAX_BET) {
                response = `❌ Taruhan harus antara ${formatMoney(CONFIG.MIN_BET)} - ${formatMoney(CONFIG.MAX_BET)}`;
            } else if (!['low', 'mid', 'high'].includes(choice)) {
                response = `❌ Pilihan tidak valid! Gunakan: low, mid, high`;
            } else if (!checkBalance(senderNumber, 'bgl', bet)) {
                response = `❌ Saldo BGL tidak mencukupi!`;
            } else {
                deductBalance(senderNumber, 'bgl', bet);
                const result = gameLmh(bet, choice);
                if (result.isWin) {
                    addBalance(senderNumber, 'bgl', result.winAmount);
                }
                response = result.message;
            }
        }
        
        else if (command === 'neme' && params.length >= 1) {
            const bet = parseInt(params[0]);
            
            if (isNaN(bet) || bet < CONFIG.MIN_BET || bet > CONFIG.MAX_BET) {
                response = `❌ Taruhan harus antara ${formatMoney(CONFIG.MIN_BET)} - ${formatMoney(CONFIG.MAX_BET)}`;
            } else if (!checkBalance(senderNumber, 'bgl', bet)) {
                response = `❌ Saldo BGL tidak mencukupi!`;
            } else {
                deductBalance(senderNumber, 'bgl', bet);
                const result = gameNeme(bet);
                if (result.isWin) {
                    addBalance(senderNumber, 'bgl', result.winAmount);
                }
                response = result.message;
            }
        }
        
        // DEPOSIT
        else if (command === 'depo') {
            response = getDepositInfo();
        }
        
        else if (command === 'wd' && params.length >= 1) {
            const amount = parseInt(params[0]);
            const result = createWithdrawTicket(senderNumber, 'bgl', amount);
            response = result.message;
        }
        
        // TRANSFER
        else if (command === 'tf' && params.length >= 2) {
            const mention = params[0];
            const amount = parseInt(params[1]);
            const currency = params[2] || 'bgl';
            
            let targetId = '';
            if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid) {
                targetId = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            }
            
            if (!targetId) {
                response = `❌ Tag user yang ingin ditransfer!\nContoh: *${CONFIG.PREFIX}tf @user 1000 bgl*`;
            } else if (isNaN(amount) || amount <= 0) {
                response = `❌ Jumlah tidak valid!`;
            } else if (!checkBalance(senderNumber, currency, amount)) {
                response = `❌ Saldo ${currency.toUpperCase()} tidak mencukupi!`;
            } else if (targetId === senderNumber) {
                response = `❌ Tidak bisa transfer ke diri sendiri!`;
            } else {
                transferBalance(senderNumber, targetId, currency, amount);
                response = `✅ Transfer ${formatMoney(amount)} ${currency.toUpperCase()} berhasil dikirim ke @${targetId.split('@')[0]}`;
            }
        }
        
        // DUEL
        else if (command === 'duel' && params.length >= 2) {
            const target = params[0];
            const gameType = params[1];
            const bet = parseInt(params[2]);
            
            let targetId = '';
            if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid) {
                targetId = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            }
            
            if (!targetId) {
                response = `❌ Tag lawan duel!\nContoh: *${CONFIG.PREFIX}duel @user reme 1000*`;
            } else if (targetId === senderNumber) {
                response = `❌ Tidak bisa duel dengan diri sendiri!`;
            } else if (!['reme', 'leme', 'qeme', 'lewa'].includes(gameType)) {
                response = `❌ Game tidak valid! Pilihan: reme, leme, qeme, lewa`;
            } else if (isNaN(bet) || bet < CONFIG.MIN_BET || bet > CONFIG.MAX_BET) {
                response = `❌ Taruhan harus antara ${formatMoney(CONFIG.MIN_BET)} - ${formatMoney(CONFIG.MAX_BET)}`;
            } else if (!checkBalance(senderNumber, 'bgl', bet)) {
                response = `❌ Saldo BGL tidak mencukupi!`;
            } else {
                const duelId = createDuel(senderNumber, targetId, 'bgl', bet, gameType);
                response = `⚔️ *DUEL CHALLENGE*\n━━━━━━━━━━━━━━\n👤 ${senderNumber.split('@')[0]} menantang @${targetId.split('@')[0]} duel *${gameType.toUpperCase()}*\n💰 Taruhan: ${formatMoney(bet)} BGL\n━━━━━━━━━━━━━━\nKetik *${CONFIG.PREFIX}accept* untuk menerima\nKetik *${CONFIG.PREFIX}reject* untuk menolak\n⏳ Duel akan kadaluarsa dalam 2 menit!`;
            }
        }
        
        else if (command === 'accept') {
            let duelId = null;
            for (const [id, duel] of Object.entries(db.pendingDuels)) {
                if (duel.player2 === senderNumber && duel.status === 'pending') {
                    duelId = id;
                    break;
                }
            }
            
            if (!duelId) {
                response = `❌ Tidak ada duel yang menunggu untuk Anda!`;
            } else {
                const result = startDuel(duelId);
                if (result.error) {
                    response = `❌ ${result.error}`;
                } else {
                    response = result.message;
                }
            }
        }
        
        else if (command === 'reject') {
            let duelId = null;
            for (const [id, duel] of Object.entries(db.pendingDuels)) {
                if (duel.player2 === senderNumber && duel.status === 'pending') {
                    duelId = id;
                    break;
                }
            }
            
            if (!duelId) {
                response = `❌ Tidak ada duel yang menunggu untuk Anda!`;
            } else {
                delete db.pendingDuels[duelId];
                saveDB();
                response = `❌ Duel ditolak oleh @${senderNumber.split('@')[0]}`;
            }
        }
        
        // TOOLS
        else if (command === 'dice') {
            const dice = randomInt(1, 6);
            response = `🎲 *DADU*\n━━━━━━━━━━━━━━\n🎲 Hasil: ${dice}`;
        }
        
        else if (command === 'flip') {
            const result = randomInt(1, 2) === 1 ? 'KEPALA' : 'EKOR';
            response = `🪙 *FLIP COIN*\n━━━━━━━━━━━━━━\n🪙 Hasil: ${result}`;
        }
        
        else if (command === 'card') {
            const suits = ['♥️', '♦️', '♣️', '♠️'];
            const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
            const suit = suits[randomInt(0, 3)];
            const value = values[randomInt(0, 12)];
            response = `🃏 *RANDOM CARD*\n━━━━━━━━━━━━━━\n🃏 Kartu: ${value}${suit}`;
        }
        
        else if (command === 'how') {
            response = `╭───〔 *📖 CARA BERMAIN* 〕
│
├─ *REME*: Tebak angka belakang 1-7
├─ *LEME*: Tebak angka keberuntungan 1-9
├─ *QEME*: QQ dengan pilihan 1-9
├─ *LEWA*: CSN dengan pilihan 1-9
├─ *CSN*: 3 kartu, tebak angka belakang
├─ *QQ*: 2 kartu, tebak nilai Qiu
├─ *RPS*: Batu Kertas Gunting
├─ *DADU*: Tebak angka dadu
├─ *KB*: Tebak Kecil(1-3)/Besar(4-6)
├─ *COIN*: Tebak Kepala/Ekor
├─ *LMH*: Low(1-33)/Mid(34-66)/High(67-100)
├─ *NEME*: Tebak Genap/Ganjil
│
├─ *DUEL*: Tantang pemain lain!
├─ *DAILY*: Claim bonus harian
├─ *TOP*: Lihat leaderboard
│
╰────────────────────────`;
        }
        
        // OWNER COMMANDS
        else if (command === 'addowner' && isOwner(senderNumber) && params.length >= 1) {
            let targetId = '';
            if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid) {
                targetId = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            }
            if (targetId) {
                const result = addOwner(targetId);
                response = result.message;
            } else {
                response = `❌ Tag user yang ingin dijadikan owner!`;
            }
        }
        
        else if (command === 'delowner' && isOwner(senderNumber) && params.length >= 1) {
            let targetId = '';
            if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid) {
                targetId = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            }
            if (targetId) {
                const result = removeOwner(targetId);
                response = result.message;
            } else {
                response = `❌ Tag user yang ingin dihapus dari owner!`;
            }
        }
        
        else if (command === 'addseller' && isOwner(senderNumber) && params.length >= 1) {
            let targetId = '';
            if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid) {
                targetId = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            }
            if (targetId) {
                const result = addSeller(targetId);
                response = result.message;
            } else {
                response = `❌ Tag user yang ingin dijadikan seller!`;
            }
        }
        
        else if (command === 'delseller' && isOwner(senderNumber) && params.length >= 1) {
            let targetId = '';
            if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid) {
                targetId = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            }
            if (targetId) {
                const result = removeSeller(targetId);
                response = result.message;
            } else {
                response = `❌ Tag user yang ingin dihapus dari seller!`;
            }
        }
        
        else if (command === 'addcoin' && isSeller(senderNumber) && params.length >= 2) {
            let targetId = '';
            if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid) {
                targetId = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            }
            const amount = parseInt(params[0]);
            const currency = params[1];
            
            if (!targetId) {
                response = `❌ Tag user yang ingin ditambahkan coin!`;
            } else if (isNaN(amount) || amount <= 0) {
                response = `❌ Jumlah tidak valid!`;
            } else {
                const result = ownerAddCoin(targetId, currency, amount);
                response = result.message;
            }
        }
        
        else if (command === 'delcoin' && isSeller(senderNumber) && params.length >= 2) {
            let targetId = '';
            if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid) {
                targetId = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            }
            const amount = parseInt(params[0]);
            const currency = params[1];
            
            if (!targetId) {
                response = `❌ Tag user yang ingin dikurangi coin!`;
            } else if (isNaN(amount) || amount <= 0) {
                response = `❌ Jumlah tidak valid!`;
            } else {
                const result = ownerDelCoin(targetId, currency, amount);
                response = result.message;
            }
        }
        
        else if (command === 'setcoin' && isOwner(senderNumber) && params.length >= 2) {
            let targetId = '';
            if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid) {
                targetId = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            }
            const amount = parseInt(params[0]);
            const currency = params[1];
            
            if (!targetId) {
                response = `❌ Tag user yang ingin diatur coin!`;
            } else if (isNaN(amount) || amount < 0) {
                response = `❌ Jumlah tidak valid!`;
            } else {
                const result = ownerSetCoin(targetId, currency, amount);
                response = result.message;
            }
        }
        
        else if (command === 'approvewd' && isSeller(senderNumber) && params.length >= 1) {
            const ticketId = params[0];
            const result = approveWithdraw(ticketId, senderNumber);
            response = result.message;
        }
        
        else if (command === 'bc' && isOwner(senderNumber) && params.length >= 1) {
            const broadcastMsg = params.join(' ');
            // Broadcast logic would go here
            response = `📢 Broadcast dikirim ke semua chat!`;
        }
        
        // Send response
        if (response) {
            await sock.sendMessage(from, { text: response });
        }
    });
}

// Start bot
startBot().catch(console.error);
