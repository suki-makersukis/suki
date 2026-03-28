// ==========================================
// GAME DUEL LUCKY MAFIAPS
// WhatsApp Bot - Railway Ready
// ==========================================

import { default as makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pkg from 'pino';
const P = pkg;
import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';
import qrcode from 'qrcode-terminal';

moment.tz.setDefault('Asia/Jakarta');

// ==========================================
// DATABASE SETUP
// ==========================================
const DB_FILE = './database.json';

let db = {
    users: {},
    roles: {
        owners: ['6288317349561@s.whatsapp.net'],
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
    gameHistory: {}
};

function loadDB() {
    if (fs.existsSync(DB_FILE)) {
        try {
            db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            console.log('✅ Database loaded');
        } catch (e) {
            console.log('❌ Error loading database');
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
    BOT_NUMBER: '',
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
    DAILY_BONUS: 5000,
    WITHDRAW_MIN: 50000,
    PREFIX: '!',
    SESSION_DIR: './sessions'
};

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
        return { success: true, message: `✅ Owner added: @${userId.split('@')[0]}` };
    }
    return { success: false, message: `❌ Already owner!` };
}

function removeOwner(userId) {
    if (db.roles.owners.includes(userId) && db.roles.owners.length > 1) {
        const index = db.roles.owners.indexOf(userId);
        db.roles.owners.splice(index, 1);
        saveDB();
        return { success: true, message: `✅ Owner removed: @${userId.split('@')[0]}` };
    }
    return { success: false, message: `❌ Cannot remove last owner!` };
}

function addSeller(userId) {
    if (!db.roles.sellers.includes(userId)) {
        db.roles.sellers.push(userId);
        saveDB();
        return { success: true, message: `✅ Seller added: @${userId.split('@')[0]}` };
    }
    return { success: false, message: `❌ Already seller!` };
}

function removeSeller(userId) {
    const index = db.roles.sellers.indexOf(userId);
    if (index > -1) {
        db.roles.sellers.splice(index, 1);
        saveDB();
        return { success: true, message: `✅ Seller removed: @${userId.split('@')[0]}` };
    }
    return { success: false, message: `❌ Not a seller!` };
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
                totalBetBGL: 0,
                totalBetMGL: 0,
                totalWinBGL: 0,
                totalWinMGL: 0,
                gamesPlayed: 0,
                streak: 0
            },
            createdAt: new Date().toISOString(),
            lastDaily: null
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
        if (currency === 'bgl') {
            user.stats.totalBetBGL += amount;
        } else {
            user.stats.totalBetMGL += amount;
        }
        saveDB();
        return true;
    }
    return false;
}

function addBalance(userId, currency, amount, reason = '') {
    const user = getUser(userId);
    user.balance[currency] += amount;
    if (currency === 'bgl') {
        user.stats.totalWinBGL += amount;
    } else {
        user.stats.totalWinMGL += amount;
    }
    
    if (reason === 'daily') {
        user.lastDaily = Date.now();
    }
    
    saveDB();
    return true;
}

function transferBalance(fromId, toId, currency, amount) {
    if (checkBalance(fromId, currency, amount)) {
        deductBalance(fromId, currency, amount);
        addBalance(toId, currency, amount);
        return true;
    }
    return false;
}

// ==========================================
// PARSE BET (Support BGL & MGL)
// ==========================================

function parseBet(betString) {
    const match = betString.match(/^(\d+)(bgl|mgl)$/i);
    if (!match) return null;
    
    return {
        amount: parseInt(match[1]),
        currency: match[2].toLowerCase()
    };
}

function formatBetDisplay(amount, currency) {
    return `${formatMoney(amount)} ${currency.toUpperCase()}`;
}

// ==========================================
// GAME MECHANICS
// ==========================================

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
        message: `🎲 *REME*\n━━━━━━━━━━━━━━\n🎯 Pilihan: ${choice}\n🎲 Angka: ${randomNumber}\n${isWin ? `✅ MENANG ${formatMoney(winAmount)}!` : '❌ KALAH!'}`
    };
}

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
        message: `🍀 *LEME*\n━━━━━━━━━━━━━━\n🍀 Pilihan: ${choice}\n🎲 Angka: ${luckyNumber}\n${isWin ? `✅ MENANG ${formatMoney(winAmount)}!` : '❌ KALAH!'}`
    };
}

function gameQeme(betAmount, choice) {
    const validChoices = ['b1', 'b3', 'b5', 'b7', 'b9'];
    if (!validChoices.includes(choice)) return null;
    
    const cards = [randomInt(1, 13), randomInt(1, 13)];
    const total = (cards[0] + cards[1]) % 10;
    const target = parseInt(choice[1]);
    const isWin = total === target;
    const winAmount = isWin ? betAmount * 10 : 0;
    
    return {
        isWin,
        winAmount,
        cards,
        total,
        message: `🃏 *QEME*\n━━━━━━━━━━━━━━\n🃏 Kartu: ${cards[0]} | ${cards[1]}\n🎯 Nilai: ${total}\n${isWin ? `✅ MENANG ${formatMoney(winAmount)}!` : '❌ KALAH!'}`
    };
}

function gameLewa(betAmount, choice) {
    const validChoices = ['b1', 'b3', 'b5', 'b7', 'b9'];
    if (!validChoices.includes(choice)) return null;
    
    const cards = [randomInt(1, 13), randomInt(1, 13), randomInt(1, 13)];
    const sum = cards.reduce((a, b) => a + b, 0);
    const lastDigit = sum % 10;
    const target = parseInt(choice[1]);
    const isWin = lastDigit === target;
    const winAmount = isWin ? betAmount * 10 : 0;
    
    return {
        isWin,
        winAmount,
        cards,
        sum,
        lastDigit,
        message: `🎴 *LEWA*\n━━━━━━━━━━━━━━\n🎴 Kartu: ${cards.join(' | ')}\n📊 Total: ${sum} | Akhir: ${lastDigit}\n${isWin ? `✅ MENANG ${formatMoney(winAmount)}!` : '❌ KALAH!'}`
    };
}

function gameCsn(betAmount, choice) {
    const validChoices = ['b1', 'b3', 'b5', 'b7'];
    if (!validChoices.includes(choice)) return null;
    
    const cards = [randomInt(1, 13), randomInt(1, 13), randomInt(1, 13)];
    const sum = cards.reduce((a, b) => a + b, 0);
    const lastDigit = sum % 10;
    const target = parseInt(choice[1]);
    const isWin = lastDigit === target;
    const winAmount = isWin ? betAmount * 10 : 0;
    
    return {
        isWin,
        winAmount,
        cards,
        sum,
        lastDigit,
        message: `🎴 *CSN*\n━━━━━━━━━━━━━━\n🎴 Kartu: ${cards.join(', ')}\nTotal: ${sum} | Akhir: ${lastDigit}\n${isWin ? `✅ MENANG ${formatMoney(winAmount)}!` : '❌ KALAH!'}`
    };
}

function gameQq(betAmount, choice) {
    const validChoices = ['b1', 'b3', 'b5', 'b7'];
    if (!validChoices.includes(choice)) return null;
    
    const cards = [randomInt(1, 13), randomInt(1, 13)];
    const total = (cards[0] + cards[1]) % 10;
    const target = parseInt(choice[1]);
    const isWin = total === target;
    const winAmount = isWin ? betAmount * 10 : 0;
    
    return {
        isWin,
        winAmount,
        cards,
        total,
        message: `🃏 *QQ*\n━━━━━━━━━━━━━━\nKartu: ${cards.join(', ')} | Nilai: ${total}\n${isWin ? `✅ MENANG ${formatMoney(winAmount)}!` : '❌ KALAH!'}`
    };
}

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
        message: `🖐️ *RPS*\n━━━━━━━━━━━━━━\n👤 Anda: ${choice}\n🤖 Bot: ${botChoice}\n${isWin ? `✅ MENANG ${formatMoney(winAmount)}!` : '❌ KALAH!'}`
    };
}

function gameDadu(betAmount, choice) {
    const validChoices = ['b1', 'b3', 'b5', 'b7'];
    if (!validChoices.includes(choice)) return null;
    
    const dice = randomInt(1, 6);
    const target = parseInt(choice[1]);
    const isWin = dice === target;
    const winAmount = isWin ? betAmount * 6 : 0;
    
    return {
        isWin,
        winAmount,
        dice,
        message: `🎲 *DADU*\n━━━━━━━━━━━━━━\n🎲 Dadu: ${dice}\n🎯 Target: ${choice}\n${isWin ? `✅ MENANG ${formatMoney(winAmount)}!` : '❌ KALAH!'}`
    };
}

function gameKb(betAmount, choice) {
    const dice = randomInt(1, 6);
    const isKecil = dice <= 3;
    const isWin = (choice === 'kecil' && isKecil) || (choice === 'besar' && !isKecil);
    const winAmount = isWin ? betAmount * 2 : 0;
    
    return {
        isWin,
        winAmount,
        dice,
        message: `🎲 *KB*\n━━━━━━━━━━━━━━\n🎲 Dadu: ${dice} (${dice <= 3 ? 'KECIL' : 'BESAR'})\n🎯 Pilihan: ${choice.toUpperCase()}\n${isWin ? `✅ MENANG ${formatMoney(winAmount)}!` : '❌ KALAH!'}`
    };
}

function gameCoin(betAmount, choice) {
    const result = randomInt(1, 2) === 1 ? 'head' : 'tail';
    const isWin = choice === result;
    const winAmount = isWin ? betAmount * 2 : 0;
    
    return {
        isWin,
        winAmount,
        result,
        message: `🪙 *COIN*\n━━━━━━━━━━━━━━\n🪙 Hasil: ${result === 'head' ? 'KEPALA' : 'EKOR'}\n🎯 Pilihan: ${choice.toUpperCase()}\n${isWin ? `✅ MENANG ${formatMoney(winAmount)}!` : '❌ KALAH!'}`
    };
}

function gameLmh(betAmount, choice) {
    const number = randomInt(1, 100);
    let isWin = false;
    
    if (choice === 'low' && number <= 33) isWin = true;
    else if (choice === 'mid' && number >= 34 && number <= 66) isWin = true;
    else if (choice === 'high' && number >= 67) isWin = true;
    
    const winAmount = isWin ? betAmount * 3 : 0;
    
    return {
        isWin,
        winAmount,
        number,
        message: `🎯 *LMH*\n━━━━━━━━━━━━━━\n🎯 Angka: ${number}\n🎯 Range: ${choice === 'low' ? '1-33' : choice === 'mid' ? '34-66' : '67-100'}\n${isWin ? `✅ MENANG ${formatMoney(winAmount)}!` : '❌ KALAH!'}`
    };
}

function gameNeme(betAmount) {
    const number = randomInt(1, 100);
    const isWin = number % 2 === 0;
    const winAmount = isWin ? betAmount * 2 : 0;
    
    return {
        isWin,
        winAmount,
        number,
        message: `🎯 *NEME*\n━━━━━━━━━━━━━━\n🎯 Angka: ${number} (${number % 2 === 0 ? 'GENAP' : 'GANJIL'})\n${isWin ? `✅ MENANG ${formatMoney(winAmount)}!` : '❌ KALAH!'}`
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
            message: `🤝 *DUEL SERI!*\n━━━━━━━━━━━━━━\n💰 Taruhan ${formatBetDisplay(duel.betAmount, duel.currency)} dikembalikan!\n\n🎲 Hasil Player 1:\n${result1.message}\n\n🎲 Hasil Player 2:\n${result2.message}`
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
        message: `🏆 *DUEL ${duel.gameType.toUpperCase()}* 🏆\n━━━━━━━━━━━━━━\n💰 Taruhan: ${formatBetDisplay(duel.betAmount, duel.currency)}\n━━━━━━━━━━━━━━\n🎲 HASIL PLAYER 1:\n${result1.message}\n\n🎲 HASIL PLAYER 2:\n${result2.message}\n━━━━━━━━━━━━━━\n🏅 *PEMENANG:* @${winner.split('@')[0]}\n🎁 Hadiah: ${formatBetDisplay(winnerPrize, duel.currency)}\n💸 Pajak: ${formatBetDisplay(tax, duel.currency)}\n✨ *Streak: ${winnerUser.stats.streak}*`
    };
}

// ==========================================
// DEPOSIT SYSTEM
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
        return { success: false, message: `❌ Minimal withdraw ${formatMoney(CONFIG.WITHDRAW_MIN)} ${currency.toUpperCase()}` };
    }
    
    if (!checkBalance(userId, currency, amount)) {
        return { success: false, message: `❌ Saldo ${currency.toUpperCase()} tidak mencukupi!` };
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
        message: `✅ Ticket withdraw dibuat!\n🆔 ID: ${ticketId}\n💰 Jumlah: ${formatBetDisplay(amount, currency)}`
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
            message: `✅ Withdraw disetujui!\n👤 User: @${ticket.userId.split('@')[0]}\n💰 Jumlah: ${formatBetDisplay(ticket.amount, ticket.currency)}`
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
    return { success: true, message: `✅ Added ${formatBetDisplay(amount, currency)} to @${userId.split('@')[0]}` };
}

function ownerDelCoin(userId, currency, amount) {
    if (checkBalance(userId, currency, amount)) {
        deductBalance(userId, currency, amount);
        return { success: true, message: `✅ Removed ${formatBetDisplay(amount, currency)} from @${userId.split('@')[0]}` };
    }
    return { success: false, message: `❌ Insufficient balance!` };
}

function ownerSetCoin(userId, currency, amount) {
    const user = getUser(userId);
    user.balance[currency] = amount;
    saveDB();
    return { success: true, message: `✅ Set @${userId.split('@')[0]} balance to ${formatBetDisplay(amount, currency)}` };
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
│
│  📝 *Format Bet:* <jumlah>bgl atau <jumlah>mgl
│  📝 *Contoh:* reme 1000bgl b3
│
├──〔 🎮 GAME PVP DUEL 〕
│  •⚔️ *duel* @tag <game> <bet>
│  •✅ *accept* - Terima duel
│  •❌ *reject* - Tolak duel
│
├──〔 💰 ECONOMY SYSTEM 〕
│  •💵 *cu* — cek uang
│  •💸 *tf* @tag <jumlah>bgl/mgl
│  •🥇 *top* — leaderboard
│  •🎁 *daily* — bonus harian
│
├──〔 💳 DEPOSIT SYSTEM 〕
│  •💳 *depo* — info deposit
│  •💳 *wd* <jumlah> <bgl/mgl> — withdraw
│
├──〔 🛠️ADMIN COMMANDS 〕
│  •👑 *addowner* @tag
│  •👑 *delowner* @tag
│  •🛡️ *addseller* @tag
│  •🛡️ *delseller* @tag
│  •➕ *addcoin* @tag <jumlah> <bgl/mgl>
│  •➖ *delcoin* @tag <jumlah> <bgl/mgl>
│  •✅ *approvewd* <ticket_id>
│
├──〔 🛠️TOOLS 〕
│  •🎲 *dice* — roll dadu
│  •🪙 *flip* — flip coin
│  •🃏 *card* — random kartu
│  •🔰 *how* — cara bermain
│
╰────────────────────────
© ${CONFIG.BOT_NAME}`;
}

// ==========================================
// WHATSAPP BOT CONNECTION
// ==========================================

async function startBot() {
    console.log('🤖 Starting Duel Lucky MafiaPS Bot...');
    
    const { state, saveCreds } = await useMultiFileAuthState(CONFIG.SESSION_DIR);
    
    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        auth: state,
        browser: ['Duel Lucky MafiaPS', 'Chrome', '1.0.0']
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n📱 SCAN QR CODE DENGAN WHATSAPP:\n');
            qrcode.generate(qr, { small: true });
            console.log('\n');
        }
        
        if (connection === 'open') {
            console.log('✅ Bot Connected Successfully!');
            console.log(`🤖 ${CONFIG.BOT_NAME} is running...`);
            
            if (sock.user) {
                CONFIG.BOT_NUMBER = sock.user.id;
                console.log(`📱 Bot Number: ${CONFIG.BOT_NUMBER}`);
            }
            
            // Send online notification to owner
            for (const owner of db.roles.owners) {
                try {
                    await sock.sendMessage(owner, { text: `✅ *${CONFIG.BOT_NAME}* is now ONLINE!\n🕐 ${getTimeNow()}` });
                } catch (e) {}
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
        const from = sender;
        const senderNumber = msg.key.participant || sender;
        
        if (!messageContent.startsWith(CONFIG.PREFIX)) return;
        
        const args = messageContent.slice(CONFIG.PREFIX.length).trim().split(/ +/);
        const command = args[0].toLowerCase();
        const params = args.slice(1);
        
        console.log(`[${getTimeNow()}] Cmd: ${command} from ${senderNumber.split('@')[0]}`);
        
        let response = '';
        
        // MENU
        if (command === 'menu' || command === 'help') {
            response = getMainMenu();
        }
        
        // ECONOMY
        else if (command === 'cu') {
            const user = getUser(senderNumber);
            response = `╭───〔 *💵 SALDO* 〕\n│\n├─ 💎 BGL: ${formatMoney(user.balance.bgl)}\n├─ 💎 MGL: ${formatMoney(user.balance.mgl)}\n│\n├─ 📊 STATS:\n├─ 🏆 Menang: ${user.stats.wins}\n├─ 💔 Kalah: ${user.stats.losses}\n├─ 🎲 Streak: ${user.stats.streak}\n╰────────────────────────`;
        }
        
        else if (command === 'daily') {
            const user = getUser(senderNumber);
            const now = Date.now();
            const lastDaily = user.lastDaily || 0;
            const hoursDiff = (now - lastDaily) / (1000 * 60 * 60);
            
            if (hoursDiff >= 24) {
                addBalance(senderNumber, 'bgl', CONFIG.DAILY_BONUS, 'daily');
                response = `🎁 *DAILY BONUS*\n✅ +${formatMoney(CONFIG.DAILY_BONUS)} BGL`;
            } else {
                const remaining = Math.ceil(24 - hoursDiff);
                response = `⏰ Tunggu ${remaining} jam lagi!`;
            }
        }
        
        else if (command === 'top') {
            const users = Object.entries(db.users)
                .sort((a, b) => (b[1].stats.totalWinBGL + b[1].stats.totalWinMGL) - (a[1].stats.totalWinBGL + a[1].stats.totalWinMGL))
                .slice(0, 10);
            
            let leaderboard = '╭───〔 *🏆 TOP 10* 〕\n│\n';
            users.forEach(([id, data], index) => {
                leaderboard += `├─ ${index + 1}. @${id.split('@')[0]}\n`;
                leaderboard += `│   🏆 ${formatMoney(data.stats.totalWinBGL + data.stats.totalWinMGL)}\n`;
            });
            leaderboard += '╰────────────────────────';
            response = leaderboard;
        }
        
        // GAMES
        else if (['reme', 'leme', 'qeme', 'lewa', 'csn', 'qq', 'rps', 'dadu', 'kb', 'coin', 'lmh', 'neme'].includes(command) && params.length >= 2) {
            const betString = params[0];
            const choice = params[1];
            const parsedBet = parseBet(betString);
            
            if (!parsedBet) {
                response = `❌ Format salah! Contoh: ${command} 1000bgl b3`;
            } else if (parsedBet.amount < CONFIG.MIN_BET || parsedBet.amount > CONFIG.MAX_BET) {
                response = `❌ Bet harus ${formatMoney(CONFIG.MIN_BET)}-${formatMoney(CONFIG.MAX_BET)} ${parsedBet.currency.toUpperCase()}`;
            } else if (!checkBalance(senderNumber, parsedBet.currency, parsedBet.amount)) {
                response = `❌ Saldo ${parsedBet.currency.toUpperCase()} tidak cukup!`;
            } else {
                deductBalance(senderNumber, parsedBet.currency, parsedBet.amount);
                let result;
                
                switch (command) {
                    case 'reme': result = gameReme(parsedBet.amount, choice); break;
                    case 'leme': result = gameLeme(parsedBet.amount, choice); break;
                    case 'qeme': result = gameQeme(parsedBet.amount, choice); break;
                    case 'lewa': result = gameLewa(parsedBet.amount, choice); break;
                    case 'csn': result = gameCsn(parsedBet.amount, choice); break;
                    case 'qq': result = gameQq(parsedBet.amount, choice); break;
                    case 'rps': result = gameRps(parsedBet.amount, choice); break;
                    case 'dadu': result = gameDadu(parsedBet.amount, choice); break;
                    case 'kb': result = gameKb(parsedBet.amount, choice); break;
                    case 'coin': result = gameCoin(parsedBet.amount, choice); break;
                    case 'lmh': result = gameLmh(parsedBet.amount, choice); break;
                    case 'neme': result = gameNeme(parsedBet.amount); break;
                }
                
                if (result) {
                    if (result.isWin) {
                        addBalance(senderNumber, parsedBet.currency, result.winAmount);
                    }
                    response = `🎮 *${command.toUpperCase()}*\n💰 Bet: ${formatBetDisplay(parsedBet.amount, parsedBet.currency)}\n${result.message}\n💎 Sisa: ${formatMoney(getUser(senderNumber).balance[parsedBet.currency])}`;
                } else {
                    addBalance(senderNumber, parsedBet.currency, parsedBet.amount);
                    response = `❌ Pilihan tidak valid!`;
                }
            }
        }
        
        // DEPOSIT
        else if (command === 'depo') {
            response = getDepositInfo();
        }
        
        else if (command === 'wd' && params.length >= 2) {
            const amount = parseInt(params[0]);
            const currency = params[1];
            const result = createWithdrawTicket(senderNumber, currency, amount);
            response = result.message;
        }
        
        // TRANSFER
        else if (command === 'tf' && params.length >= 2) {
            const betString = params[1];
            const parsedBet = parseBet(betString);
            
            let targetId = '';
            if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid) {
                targetId = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            }
            
            if (!targetId) {
                response = `❌ Tag user! Contoh: ${CONFIG.PREFIX}tf @user 1000bgl`;
            } else if (!parsedBet) {
                response = `❌ Format salah! Contoh: ${CONFIG.PREFIX}tf @user 1000bgl`;
            } else if (!checkBalance(senderNumber, parsedBet.currency, parsedBet.amount)) {
                response = `❌ Saldo tidak cukup!`;
            } else if (targetId === senderNumber) {
                response = `❌ Tidak bisa transfer sendiri!`;
            } else {
                transferBalance(senderNumber, targetId, parsedBet.currency, parsedBet.amount);
                response = `✅ Transfer ${formatBetDisplay(parsedBet.amount, parsedBet.currency)} ke @${targetId.split('@')[0]}`;
            }
        }
        
        // DUEL
        else if (command === 'duel' && params.length >= 3) {
            const gameType = params[1];
            const betString = params[2];
            const parsedBet = parseBet(betString);
            
            let targetId = '';
            if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid) {
                targetId = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            }
            
            if (!targetId) {
                response = `❌ Tag lawan! Contoh: ${CONFIG.PREFIX}duel @user reme 1000bgl`;
            } else if (targetId === senderNumber) {
                response = `❌ Tidak bisa duel sendiri!`;
            } else if (!parsedBet) {
                response = `❌ Format bet salah!`;
            } else if (!checkBalance(senderNumber, parsedBet.currency, parsedBet.amount)) {
                response = `❌ Saldo tidak cukup!`;
            } else {
                const duelId = createDuel(senderNumber, targetId, parsedBet.currency, parsedBet.amount, gameType);
                response = `⚔️ *DUEL CHALLENGE*\n👤 ${senderNumber.split('@')[0]} vs @${targetId.split('@')[0]}\n💰 ${formatBetDisplay(parsedBet.amount, parsedBet.currency)}\n🎮 ${gameType.toUpperCase()}\n\nKetik *${CONFIG.PREFIX}accept* atau *${CONFIG.PREFIX}reject*`;
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
                response = `❌ Tidak ada duel yang menunggu!`;
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
                response = `❌ Tidak ada duel yang menunggu!`;
            } else {
                delete db.pendingDuels[duelId];
                saveDB();
                response = `❌ Duel ditolak!`;
            }
        }
        
        // TOOLS
        else if (command === 'dice') {
            response = `🎲 *DADU*\n🎲 Hasil: ${randomInt(1, 6)}`;
        }
        
        else if (command === 'flip') {
            response = `🪙 *FLIP*\n🪙 Hasil: ${randomInt(1, 2) === 1 ? 'KEPALA' : 'EKOR'}`;
        }
        
        else if (command === 'card') {
            const suits = ['♥️', '♦️', '♣️', '♠️'];
            const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
            response = `🃏 *CARD*\n🃏 ${values[randomInt(0, 12)]}${suits[randomInt(0, 3)]}`;
        }
        
        else if (command === 'how') {
            response = `📖 *CARA MAIN*\n\nFormat bet: 1000bgl atau 500mgl\n\nREME: b1/b3/b5/b7\nLEME: b1/b3/b5/b7/b9\nQEME: b1/b3/b5/b7/b9\nLEWA: b1/b3/b5/b7/b9\nRPS: batu/kertas/gunting\nKB: kecil/besar\nCOIN: head/tail\nLMH: low/mid/high\nNEME: auto genap/ganjil\n\nGunakan ${CONFIG.PREFIX}menu untuk daftar lengkap`;
        }
        
        // OWNER COMMANDS
        else if (command === 'addowner' && isOwner(senderNumber)) {
            let targetId = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (targetId) {
                const result = addOwner(targetId);
                response = result.message;
            } else {
                response = `❌ Tag user!`;
            }
        }
        
        else if (command === 'addseller' && isOwner(senderNumber)) {
            let targetId = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (targetId) {
                const result = addSeller(targetId);
                response = result.message;
            } else {
                response = `❌ Tag user!`;
            }
        }
        
        else if (command === 'addcoin' && isSeller(senderNumber) && params.length >= 2) {
            let targetId = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            const amount = parseInt(params[0]);
            const currency = params[1];
            
            if (targetId && !isNaN(amount)) {
                const result = ownerAddCoin(targetId, currency, amount);
                response = result.message;
            } else {
                response = `❌ Format: addcoin @user jumlah bgl/mgl`;
            }
        }
        
        else if (command === 'approvewd' && isSeller(senderNumber) && params.length >= 1) {
            const result = approveWithdraw(params[0], senderNumber);
            response = result.message;
        }
        
        // Send response
        if (response) {
            await sock.sendMessage(from, { text: response });
        }
    });
}

// Start bot
console.log('🚀 Starting Duel Lucky MafiaPS Bot...');
startBot().catch(console.error);
