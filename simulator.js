// simulator.js

// ==========================================
// ⚙️ ゲームバランス一括設定オブジェクト
// ==========================================
const BALANCING_CONFIG = {
    batting: {
        baseHitChance: 0.35,
        hrMultiplier: 0.85,
        pitcherH9Influence: 0.0015,
        pitcherHr9Influence: 0.3
    },
    plates: {
        bbBaseScale: 0.8,
        bbPitcherScale: 0.0004,
        soBaseScale: 0.7,
        soPitcherScale: 0.001
    }
};

// ==========================================
// 1. スケジュール生成アルゴリズム
// ==========================================
function getDynamicSchedule(roundCount) {
    let numTeams = 6; 
    let totalRounds = numTeams - 1; 
    let currentRound = roundCount % totalRounds;
    let pairings = []; 
    let list = [0, 1, 2, 3, 4, 5];
    
    for (let i = 0; i < numTeams / 2; i++) {
        let awayIdx = (currentRound + i) % (numTeams - 1);
        let homeIdx = (numTeams - 1 - i + currentRound) % (numTeams - 1);
        if (i === 0) homeIdx = numTeams - 1; 
        pairings.push([list[awayIdx], list[homeIdx]]);
    }
    return pairings;
}

// ==========================================
// 2. コアロジック & ユーザー設定
// ==========================================
let userTeamId = 0; 
let currentYear = 1; 

function selectUserTeam(val) {
    userTeamId = parseInt(val);
    let editSelect = document.getElementById("edit_team_select");
    if(editSelect) editSelect.value = userTeamId;
    onEditorTeamChange(); 
    updateUIAll();
}

function getConditionModifier(condition, type) {
    const modifiers = {
        "絶好調": { batBarrel: 1.25, batSo: 0.80, pitPitch: 1.12 }, 
        "好調":   { batBarrel: 1.12, batSo: 0.90, pitPitch: 1.05 },
        "普通":   { batBarrel: 1.00, batSo: 1.00, pitPitch: 1.00 },
        "不調":   { batBarrel: 0.85, batSo: 1.15, pitPitch: 0.92 },
        "絶不調": { batBarrel: 0.70, batSo: 1.30, pitPitch: 0.82 }
    };
    return modifiers[condition] ? modifiers[condition][type] : 1.0;
}

function changeAllPlayersCondition() {
    const conds = ["絶好調", "好調", "普通", "不調", "絶不調"];
    teams.forEach(t => {
        t.batters.forEach(b => { b.condition = conds[Math.floor(Math.random() * conds.length)]; });
        t.pitchers.forEach(p => { p.condition = conds[Math.floor(Math.random() * conds.length)]; });
    });
}

function executeFrontOfficeAI() {
    teams.forEach(t => {
        let tiredRelief = t.pitchers.find(p => p.role === "リリーフ" && p.staCurrent <= 15);
        let freshMinorRelief = t.pitchers.find(p => p.role === "二軍リリーフ" && p.staCurrent >= 30);
        if (tiredRelief && freshMinorRelief) {
            tiredRelief.role = "二軍リリーフ"; 
            freshMinorRelief.role = "リリーフ";
        }
        let slumpReserve = t.batters.find(b => b.role === 0 && (b.condition === "絶不調" || b.condition === "不調"));
        let hotMinorTeam = t.batters.find(b => b.role === -1 && (b.condition === "絶好調" || b.condition === "好調"));
        if (slumpReserve && hotMinorTeam) {
            slumpReserve.role = -1; hotMinorTeam.role = 0;
        }
    });
}

function reassignTeamRoles(t) {
    const requiredPositions = ["捕手", "一塁手", "二塁手", "三塁手", "遊撃手", "左翼手", "中堅手", "right翼手"];
    const fixedPos = ["捕手", "一塁手", "二塁手", "三塁手", "遊撃手", "左翼手", "中堅手", "右翼手"];
    
    t.batters.forEach(b => b.role = -1);

    fixedPos.forEach((pos, idx) => {
        let candidate = t.batters.find(b => b.role === -1 && (b.originalPos === pos || (b.subPositions && b.subPositions.includes(pos))));
        if (candidate) {
            candidate.role = idx + 1; 
            candidate.currentPos = pos; 
        }
    });

    fixedPos.forEach((pos, idx) => {
        let slotEmpty = !t.batters.some(b => b.role === (idx + 1));
        if (slotEmpty) {
            let backup = t.batters.find(b => b.role === -1 && (b.originalPos === pos || (b.subPositions && b.subPositions.includes(pos))));
            if (!backup) backup = t.batters.find(b => b.role === -1);
            if (backup) {
                backup.role = idx + 1;
                backup.currentPos = pos; 
            }
        }
    });

    let rCount = 0;
    t.batters.forEach(b => {
        if (b.role > 0) return;
        if (rCount < 7) { b.role = 0; rCount++; } 
        else { b.role = -1; }
        b.currentPos = b.originalPos; 
    });

    t.pitchers.forEach((p, idx) => {
        if (p.role === "先発" || p.role === "守護神" || p.role === "二軍先発") {
            p.staCurrent = p.staMax;
            return; 
        }
        if (idx < 12) {
            if (p.role !== "先発" && p.role !== "守護神") p.role = "リリーフ";
        } else {
            if (p.role !== "二軍先発") p.role = "二軍リリーフ";
        }
    });
}

function createDraftBatter() {
    let graduation = ["高卒", "大卒", "社会人"][Math.floor(Math.random() * 3)];
    let baseAge = graduation === "高卒" ? 18 : (graduation === "大卒" ? 22 : 24);
    let pos = ["捕手","一塁手","二塁手","三塁手","遊撃手","左翼手","中堅手","右翼手"][Math.floor(Math.random() * 8)];
    let prefs = ["北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島", "茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川", "新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜", "静岡", "愛知", "三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山", "鳥取", "島根", "岡山", "広島", "山口", "徳島", "香川", "愛媛", "高知", "福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"];
    
    return {
        name: generateRandomPlayerName(),
        role: -1, 
        originalPos: pos, currentPos: pos, subPositions: [], condition: "普通",
        age: baseAge, hometown: prefs[Math.floor(Math.random() * prefs.length)],
        graduation: graduation, proYears: 1, exp: 0,
        bb: 6.0 + Math.random() * 4,
        so: 15.0 + Math.random() * 10,
        barrel: 6.0 + Math.random() * 8, 
        isop: 10 + Math.floor(Math.random() * 15),
        uzr: parseFloat((Math.random() * 10 - 5).toFixed(1)), err: 2.0,
        stats: { games: 0, ab: 0, hits: 0, hr: 0, rbi: 0, bb: 0, so: 0 }
    };
}

function createDraftPitcher() {
    let graduation = ["高卒", "大卒", "社会人"][Math.floor(Math.random() * 3)];
    let baseAge = graduation === "高卒" ? 18 : (graduation === "大卒" ? 22 : 24);
    let prefs = ["北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島", "茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川", "新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜", "静岡", "愛知", "三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山", "鳥取", "島根", "岡山", "広島", "山口", "徳島", "香川", "愛媛", "高知", "福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"];

    return {
        name: generateRandomPlayerName(),
        role: "二軍リリーフ", originalPos: "投手", currentPos: "投手", condition: "普通",
        age: baseAge, hometown: prefs[Math.floor(Math.random() * prefs.length)],
        graduation: graduation, proYears: 1, exp: 0,
        h9: 60 + Math.floor(Math.random() * 12),
        k9: 60 + Math.floor(Math.random() * 15),
        bb9: 65, hr9: 55,
        staMax: Math.random() < 0.3 ? 88 : 35, 
        staCurrent: 35,
        stats: { era: 0, appearances: 0, wins: 0, losses: 0, saves: 0, ipOuts: 0, so: 0, bb: 0, er: 0 }
    };
}

function executeOffseasonRosterEvents() {
    alert(`ーーー 👔 ペナントレース終了 (ペナント第 ${currentYear} 年目) ーーー\n\nこれより「人員整理（戦力外通告）」を行います。\n「オフシーズン補強」タブを開いて、自由契約にする選手をあなたの手で選択してください！`);
    document.getElementById("draft_status_message").innerHTML = "📢 <b>オフシーズン・球団人員整理フェーズ</b>。不要な選手に戦力外通告を行ってください。";
    
    // draft.js の手動戦力外選択関数を呼び出し
    startUserReleasePhase();
    
    switchTab('tab-draft', document.querySelectorAll('.tab')[2]);
}

function processOffseasonEvolution() {
    teams.forEach(t => {
        t.batters.forEach(b => {
            b.age += 1; b.proYears += 1;
            let growthPotential = Math.min(10, Math.floor((b.exp || 0) / 15)); b.exp = 0;
            if (b.age <= 24) {
                b.barrel = Math.min(45, b.barrel + Math.floor(Math.random() * 4) + 1 + growthPotential * 0.2); 
                b.isop = Math.min(65, b.isop + Math.floor(Math.random() * 5) + 2);
                b.so = Math.max(10, b.so - Math.floor(Math.random() * 2));
                b.uzr = parseFloat((b.uzr + Math.random() * 2.5).toFixed(1));
            } else if (b.age <= 29) {
                if(Math.random() < 0.3) b.barrel = Math.min(45, b.barrel + 1);
                if(Math.random() < 0.2) b.uzr = parseFloat((b.uzr + Math.random() * 1.0 - 0.3).toFixed(1));
            } else if (b.age <= 34) {
                b.barrel = Math.max(5, b.barrel - (Math.floor(Math.random() * 2)));
                b.isop = Math.max(5, b.isop - (Math.floor(Math.random() * 3)));
                b.uzr = parseFloat((b.uzr - Math.random() * 1.5).toFixed(1));
            } else {
                b.barrel = Math.max(3, b.barrel - (Math.floor(Math.random() * 4) + 1));
                b.so = Math.min(45, b.so + Math.floor(Math.random() * 3));
                b.uzr = parseFloat((b.uzr - Math.random() * 3.0 - 1.0).toFixed(1));
            }
        });
        t.pitchers.forEach(p => {
            p.age += 1; p.proYears += 1;
            let growthPotential = Math.min(10, Math.floor((p.exp || 0) / 15)); p.exp = 0;
            if (p.age <= 24) {
                p.h9 = Math.min(99, p.h9 + Math.floor(Math.random() * 3) + 1);
                p.k9 = Math.min(99, p.k9 + Math.floor(Math.random() * 3) + 1);
            } else if (p.age <= 29) {
                if(Math.random() < 0.3) p.h9 = Math.min(99, p.h9 + 1);
            } else if (p.age <= 34) {
                p.h9 = Math.max(30, p.h9 - Math.floor(Math.random() * 3));
                p.k9 = Math.max(30, p.k9 - Math.floor(Math.random() * 3));
            } else {
                p.h9 = Math.max(20, p.h9 - (Math.floor(Math.random() * 5) + 2));
                p.k9 = Math.max(20, p.k9 - (Math.floor(Math.random() * 5) + 2));
                p.staMax = Math.max(20, p.staMax - 4);
            }
        });
    });
}

function simulateRound() {
    // 【安全ロック】もし戦力外やドラフト中にボタンが押されたら、処理を完全にブロックする
    if (totalGamesPlayed === -1) {
        alert("現在はオフシーズン補強中です！「オフシーズン補強」タブから戦力外通告またはドラフト指名を完了させてください。");
        return null;
    }

    // 143試合消化した瞬間の判定
    if (totalGamesPlayed >= MAX_GAMES) {
        // 🔥【進行ストップの超重要フラグ設定】
        // 試合数を一時的に「-1」に設定し、通常の試合進行ボタンを完全にフリーズ（ロック）させます。
        // これにより、画面の一瞬での強制上書きや無限リスタートを100%回避します。
        totalGamesPlayed = -1; 

        // オフシーズンの年齢増加と、既存プレイヤーの能力成長・衰退を行う
        processOffseasonEvolution(); 
        
        // 手動戦力外通告画面を起動
        executeOffseasonRosterEvents(); 
        return null; 
    }
    
    changeAllPlayersCondition(); 
    executeFrontOfficeAI();
    let pattern = getDynamicSchedule(totalGamesPlayed);
    let roundResults = [];
    pattern.forEach(pair => {
        let teamAway = teams[pair[0]]; let teamHome = teams[pair[1]];
        let res = executeMatchLogic(teamAway, teamHome);
        roundResults.push(res);
    });
    teams.forEach(t => { t.pitchers.forEach(p => { let recovery = p.role.includes("二軍") ? 14 : 1.5; if(p.staCurrent < p.staMax) p.staCurrent = Math.min(p.staMax, p.staCurrent + recovery); }); });
    
    totalGamesPlayed++; 
    return roundResults;
}
function playNextRound() {
    let res = simulateRound(); if(!res) return;
    let rEl = document.getElementById("quick_match_results");
    if(rEl) rEl.innerHTML = res.map(r => `<tr><td><b>${r}</b></td></tr>`).join("");
    updateUIAll();
}

function playOneWeek() {
    let lastRes = null;
    for(let i=0; i<6; i++) { let res = simulateRound(); if(res) lastRes = res; }
    if(lastRes) {
        let rEl = document.getElementById("quick_match_results");
        if(rEl) rEl.innerHTML = "<tr><td style='color:green;'><b>一週間分(6カード)を一括消化しました</b></td></tr>" + lastRes.map(r => `<tr><td>${r}</td></tr>`).join("");
    }
    updateUIAll();
}

function playAllSeason() {
    while(totalGamesPlayed < MAX_GAMES) { simulateRound(); }
    updateUIAll();
}

function resetSeason() {
    totalGamesPlayed = 0; currentYear = 1; initializeLeagueData();
    onEditorTeamChange(); updateUIAll();
}

function onEditorTeamChange() {
    let teamSelect = document.getElementById("edit_team_select");
    let teamIdx = teamSelect ? parseInt(teamSelect.value) : 0;
    let team = teams[teamIdx];
    let playerSelect = document.getElementById("edit_player_select");
    if(!playerSelect || !team) return;
    playerSelect.innerHTML = "";

    team.batters.forEach((p, idx) => { 
        let roleText = p.role >= 1 && p.role <= 9 ? `${p.role}番` : (p.role === 0 ? "一軍控え" : "二軍");
        playerSelect.innerHTML += `<option value="bat_${idx}">[野手] ${roleText} - ${p.name}</option>`; 
    });
    team.pitchers.forEach((p, idx) => { playerSelect.innerHTML += `<option value="pit_${idx}">[投手] ${p.role} - ${p.name}</option>`; });
    playerSelect.selectedIndex = 0; onEditorPlayerChange();
}

function onEditorPlayerChange() {
    let teamSelect = document.getElementById("edit_team_select");
    let teamIdx = teamSelect ? parseInt(teamSelect.value) : 0;
    let playerSelect = document.getElementById("edit_player_select");
    if(!playerSelect || !playerSelect.value) return;
    let playerVal = playerSelect.value;
    
    let type = playerVal.split("_")[0]; let idx = parseInt(playerVal.split("_")[1]);
    let player = type === "bat" ? teams[teamIdx].batters[idx] : teams[teamIdx].pitchers[idx];

    document.getElementById("form_name").value = player.name;
    
    // 🆕【守備コンバートのロック機構】
    // エディターで、その選手が持っていないポジションを選択できないようロックをかける
    let formPos = document.getElementById("form_pos");
    if (formPos) {
        for (let i = 0; i < formPos.options.length; i++) {
            formPos.options[i].disabled = false; // 一旦全解除
        }
        if (type === "bat") {
            for (let i = 0; i < formPos.options.length; i++) {
                let optVal = formPos.options[i].value;
                let isMain = (player.originalPos === optVal);
                let isSub = (player.subPositions && player.subPositions.includes(optVal));
                // メインでもサブでもない適性外ポジションは disabled にしてロック
                if (!isMain && !isSub) {
                    formPos.options[i].disabled = true;
                }
            }
        } else {
            // 投手登録の場合は「投手」以外を完全ロック
            for (let i = 0; i < formPos.options.length; i++) {
                if (formPos.options[i].value !== "投手") formPos.options[i].disabled = true;
            }
        }
    }
    
    document.getElementById("form_pos").value = player.currentPos;
    document.getElementById("form_age").value = player.age;
    let roleText = player.role >= 1 && player.role <= 9 ? `${player.role}番打者` : (player.role === 0 ? "一軍ベンチ控え" : (player.role === -1 ? "二軍調整中" : player.role));
    document.getElementById("form_role").value = roleText;

    let badge = document.getElementById("ui_player_type_badge");

    if(type === "bat") {
        if(badge) { badge.innerText = "野手登録"; badge.style.background = "#dd6b20"; }
        document.getElementById("form_bat_stats").style.display = "block";
        document.getElementById("form_pit_stats").style.display = "none";
        document.getElementById("form_bb").value = player.bb;
        document.getElementById("form_so").value = player.so;
        document.getElementById("form_barrel").value = player.barrel;
        document.getElementById("form_isop").value = player.isop;
        document.getElementById("form_uzr").value = player.uzr;
        document.getElementById("form_err").value = player.err;
        document.getElementById("form_sub_pos").value = player.subPositions ? player.subPositions.join(", ") : "なし";
    } else {
        if(badge) { badge.innerText = `投手(${player.role})`; badge.style.background = "#2b6cb0"; }
        document.getElementById("form_bat_stats").style.display = "none";
        document.getElementById("form_pit_stats").style.display = "block";
        document.getElementById("form_h9").value = player.h9;
        document.getElementById("form_k9").value = player.k9;
        document.getElementById("form_bb9").value = player.bb9;
        document.getElementById("form_hr9").value = player.hr9;
        document.getElementById("form_sta").value = player.staMax;
    }
}

function saveEditorData() {
    let teamSelect = document.getElementById("edit_team_select");
    let teamIdx = teamSelect ? parseInt(teamSelect.value) : 0;
    let playerVal = document.getElementById("edit_player_select").value;
    let type = playerVal.split("_")[0]; let idx = parseInt(playerVal.split("_")[1]);
    let team = teams[teamIdx];
    
    if(type === "bat") {
        let p = team.batters[idx];
        p.name = document.getElementById("form_name").value;
        p.originalPos = document.getElementById("form_pos").value;
        p.currentPos = p.originalPos;
        p.bb = parseFloat(document.getElementById("form_bb").value);
        p.so = parseFloat(document.getElementById("form_so").value);
        p.barrel = parseFloat(document.getElementById("form_barrel").value);
        p.isop = parseFloat(document.getElementById("form_isop").value);
        p.uzr = parseFloat(document.getElementById("form_uzr").value);
        p.err = parseFloat(document.getElementById("form_err").value);
        
        let subStr = document.getElementById("form_sub_pos").value;
        p.subPositions = subStr && subStr !== "なし" ? subStr.split(",").map(s => s.trim()) : [];
    } else {
        let p = team.pitchers[idx];
        p.name = document.getElementById("form_name").value;
        p.h9 = parseFloat(document.getElementById("form_h9").value);
        p.k9 = parseFloat(document.getElementById("form_k9").value);
        p.bb9 = parseFloat(document.getElementById("form_bb9").value);
        p.hr9 = parseFloat(document.getElementById("form_hr9").value);
        p.staMax = parseFloat(document.getElementById("form_sta").value);
    }
    onEditorTeamChange(); updateUIAll();
}

function updateUIAll() {
    let gameCountEl = document.getElementById("current_game_count");
    if(!gameCountEl) return;
    gameCountEl.innerText = totalGamesPlayed;
    
    let weekCountEl = document.getElementById("current_week_count");
    if(weekCountEl) {
        weekCountEl.innerText = Math.floor(totalGamesPlayed / 6) + 1;
    }
    
    let h2Title = document.querySelector(".card h2");
    if(h2Title && !h2Title.innerText.includes("就任")) {
        h2Title.innerHTML = `リーグ消化状況: <span id="current_game_count">${totalGamesPlayed}</span> / 143 試合 (第 <span id="current_week_count">${Math.floor(totalGamesPlayed / 6) + 1}</span> 週目)`;
    }

    let sorted = [...teams].sort((a,b) => (b.wins / ((b.wins + b.losses) || 1)) - (a.wins / ((a.wins + a.losses) || 1)));
    let sBody = document.getElementById("standings_body"); sBody.innerHTML = "";
    sorted.forEach((t, i) => {
        let wp = t.wins / ((t.wins + t.losses) || 1);
        let isMyTeam = (t.id === userTeamId);
        let teamDisplay = isMyTeam ? `<span style="color:#e53e3e;">★</span>${t.name}` : t.name;
        let rowStyle = isMyTeam ? `style="background-color: #e0f2fe; font-weight:bold;"` : ""; 
        sBody.innerHTML += `<tr ${rowStyle}><td>${i+1}</td><td><b>${teamDisplay}</b></td><td>${t.wins}</td><td>${t.losses}</td><td>${t.draws}</td><td>${wp.toFixed(3)}</td><td>-</td></tr>`;
    });

    let bList = []; teams.forEach(t => t.batters.forEach(b => bList.push({tName: t.name, data: b})));
    bList.sort((a,b) => (b.data.stats.hits / (b.data.stats.ab || 1)) - (a.data.stats.hits / (a.data.stats.ab || 1)));
    let batBody = document.querySelector("#batting_stats_table tbody"); batBody.innerHTML = "";
    bList.slice(0, 15).forEach(item => {
        let b = item.data; let avg = b.stats.hits / (b.stats.ab || 1);
        batBody.innerHTML += `<tr><td>${item.tName}</td><td><b>${b.name} (${b.age}歳)</b></td><td>${b.currentPos}</td><td>${avg.toFixed(3)}</td><td>${b.stats.games}</td><td>${b.stats.ab}</td><td>${b.stats.hits}</td><td>${b.stats.hr}</td><td>${b.stats.rbi}</td><td>${b.stats.bb}</td></tr>`;
    });

    let pList = []; teams.forEach(t => pList.push(...t.pitchers));
    pList.sort((a,b) => { if(a.stats.ipOuts === 0) return 1; if(b.stats.ipOuts === 0) return -1; return a.stats.era - b.stats.era; });
    let pitBody = document.querySelector("#pitching_stats_table tbody"); pitBody.innerHTML = "";
    pList.forEach(p => {
        let tObj = teams.find(t => t.pitchers.some(pObj => pObj.name === p.name));
        let tName = tObj ? tObj.name : "";
        pitBody.innerHTML += `<tr><td>${tName}</td><td><b>${p.name} (${p.age}歳)</b></td><td>${p.role}</td><td><b>${p.stats.ipOuts > 0 ? p.stats.era.toFixed(2) : '-.--'}</b></td><td>${p.stats.appearances}</td><td>${p.stats.wins}</td><td>${p.stats.losses}</td><td><b>${p.stats.saves}</b></td><td>${formatInningsPitched(p.stats.ipOuts)}</td><td>${p.stats.so}</td><td>${p.staCurrent}</td></tr>`;
    });
}

function switchTab(tabId, el) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active'); el.classList.add('active');
}

// 🚀 遅延読み込みを安全に処理する初期起動ブロック
window.addEventListener("DOMContentLoaded", () => {
    initializeLeagueData();

    let editTeamSelect = document.getElementById("edit_team_select");
    if (editTeamSelect) {
        editTeamSelect.innerHTML = "";
        teamNames.forEach((name, idx) => {
            let selectedAttr = idx === userTeamId ? "selected" : "";
            editTeamSelect.innerHTML += `<option value="${idx}" ${selectedAttr}>${name}</option>`;
        });
    }
    onEditorTeamChange();
    updateUIAll();
});
