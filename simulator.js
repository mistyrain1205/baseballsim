// simulator.js

// ==========================================
// ⚙️ ゲームバランス一括設定オブジェクト
// ==========================================
const BALANCING_CONFIG = {
    batting: {
        baseHitChance: 0.34,
        hrMultiplier: 0.80,
        pitcherH9Influence: 0.0012,
        pitcherHr9Influence: 0.25
    },
    plates: {
        bbBaseScale: 0.75,
        bbPitcherScale: 0.0003,
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
        "絶好調": { batBarrel: 1.20, batSo: 0.85, pitPitch: 1.10 }, 
        "好調":   { batBarrel: 1.10, batSo: 0.95, pitPitch: 1.05 },
        "普通":   { batBarrel: 1.00, batSo: 1.00, pitPitch: 1.00 },
        "不調":   { batBarrel: 0.90, batSo: 1.10, pitPitch: 0.95 },
        "絶不調": { batBarrel: 0.80, batSo: 1.20, pitPitch: 0.90 }
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
        let tiredRelief = t.pitchers.find(p => p.role === "リリーフ" && p.staCurrent <= 12);
        let freshMinorRelief = t.pitchers.find(p => p.role === "二軍リリーフ" && p.staCurrent >= 32);
        if (tiredRelief && freshMinorRelief) {
            tiredRelief.role = "二軍リリーフ"; 
            freshMinorRelief.role = "リリーフ";
        }
    });
}

function reassignTeamRoles(t) {
    const requiredPositions = ["捕手", "一塁手", "二塁手", "三塁手", "遊撃手", "左翼手", "中堅手", "右翼手"];
    
    t.batters.forEach(b => b.role = -1);

    requiredPositions.forEach((pos, idx) => {
        let candidate = t.batters.find(b => b.role === -1 && (b.originalPos === pos || (b.subPositions && b.subPositions.includes(pos))));
        if (candidate) {
            candidate.role = idx + 1; 
            candidate.currentPos = pos; 
        }
    });

    requiredPositions.forEach((pos, idx) => {
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
        stats: { games: 0, ab: 0, hits: 0, hr: 0, rbi: 0, bb: 0, so: 0, war: 0.0 }
    };
}

function createDraftPitcher() {
    let graduation = ["高卒", "大卒", "社会人"][Math.floor(Math.random() * 3)];
    let baseAge = graduation === "高卒" ? 18 : (graduation === "大卒" ? 22 : 24);
    let prefs = ["北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島", "茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川", "新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜", "静岡", "愛知", "三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山", "鳥取", "島根", "岡山", "広島", "山口", "徳島", "香川", "愛媛", "高知", "福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"];

    let isStarterStyle = Math.random() < 0.40;

    return {
        name: generateRandomPlayerName(),
        role: "二軍リリーフ", originalPos: "投手", currentPos: "投手", condition: "普通",
        age: baseAge, hometown: prefs[Math.floor(Math.random() * prefs.length)],
        graduation: graduation, proYears: 1, exp: 0,
        h9: 60 + Math.floor(Math.random() * 12),
        k9: 60 + Math.floor(Math.random() * 15),
        bb9: 65, hr9: 55,
        staMax: isStarterStyle ? 90 : 35, 
        staCurrent: isStarterStyle ? 90 : 35,
        stats: { era: 0, appearances: 0, wins: 0, losses: 0, saves: 0, ipOuts: 0, so: 0, bb: 0, er: 0, war: 0.0 }
    };
}

function executeOffseasonRosterEvents() {
    alert(`ーーー 👔 ペナントレース終了 (ペナント第 ${currentYear} 年目) ーーー\n\nこれより「人員整理（戦力外通告）」を行います。\n「オフシーズン補強」タブを開いて、自由契約にする選手をあなたの手で選択してください！`);
    
    let statusMsgEl = document.getElementById("draft_status_message");
    if(statusMsgEl) {
        statusMsgEl.innerHTML = "📢 <b>オフシーズン・球団人員整理フェーズ</b>。不要な選手に戦力外通告を行ってください。";
    }
    
    startUserReleasePhase();
    
    let allTabs = document.querySelectorAll('.tab');
    let targetTabBtn = Array.from(allTabs).find(tab => tab.innerText.includes("オフシーズン"));
    
    if (targetTabBtn) {
        switchTab('tab-draft', targetTabBtn);
    } else {
        switchTab('tab-draft', allTabs[2] || allTabs[0]);
    }
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

function formatInningsPitched(totalOuts) {
    let innings = Math.floor(totalOuts / 3); let remainingOuts = totalOuts % 3;
    return remainingOuts === 0 ? `${innings}` : `${innings}.${remainingOuts}`;
}

function advanceRunners(bases, hitKind) {
    let runs = 0;
    if (hitKind === "BB") {
        if (bases[0] && bases[1] && bases[2]) runs++;
        else if (bases[0] && bases[1]) bases[2] = true;
        else if (bases[0]) bases[1] = true;
        bases[0] = true;
    } else if (hitKind === "1B") {
        if (bases[2]) { runs++; bases[2] = false; }
        if (bases[1]) { runs++; bases[1] = false; }
        if (bases[0]) bases[1] = true;
        bases[0] = true;
    } else if (hitKind === "HR") {
        runs += 1 + (bases[0]?1:0) + (bases[1]?1:0) + (bases[2]?1:0);
        bases.fill(false);
    }
    return runs;
}

// =================================================================
// 3. 試合進行・シミュレーション中枢（完全修正版）
// =================================================================
function executeMatchLogic(away, home) {
    let awayStarters = away.pitchers.filter(p => p.role === "先発");
    let homeStarters = home.pitchers.filter(p => p.role === "先発");
    let curPAway = awayStarters[away.rotationIdx % awayStarters.length] || away.pitchers[0];
    let curPHome = homeStarters[home.rotationIdx % homeStarters.length] || home.pitchers[0];
    
    curPAway.stats.appearances++; 
    curPHome.stats.appearances++;
    
    let awayScore = 0, homeScore = 0; 
    let awayOrder = 1, homeOrder = 1;
    let pitchAway = 0, pitchHome = 0;
    
    let lineupAway = [];
    for(let i=1; i<=9; i++) { lineupAway.push(away.batters.find(b => b.role === i) || away.batters[0]); }
    let lineupHome = [];
    for(let i=1; i<=9; i++) { lineupHome.push(home.batters.find(b => b.role === i) || home.batters[0]); }

    for (let inning = 1; inning <= 9; inning++) {
        // 表の攻撃
        let outs = 0; let bases = [false, false, false];
        while (outs < 3) {
            if(pitchHome > curPHome.staMax || (inning >= 7 && homeScore - awayScore <= 2)) {
                let nextP = home.pitchers.find(p => (p.role === (inning === 9 ? "守護神" : "リリーフ")) && p.staCurrent > 15 && p !== curPHome);
                if(nextP) { curPHome = nextP; pitchHome = 0; curPHome.stats.appearances++; }
            }
            let b = lineupAway[(awayOrder-1)%9]; 
            b.stats.ab++; b.stats.games = (b.stats.games || 0) + 1;
            pitchHome += 4;
            
            let bbP = (b.bb/100)*BALANCING_CONFIG.plates.bbBaseScale + ((100-curPHome.bb9)*BALANCING_CONFIG.plates.bbPitcherScale);
            let soP = ((b.so/100)*BALANCING_CONFIG.plates.soBaseScale) + ((curPHome.k9*BALANCING_CONFIG.plates.soPitcherScale));
            
            if(Math.random() < bbP) {
                b.stats.bb++; curPHome.stats.bb++; let r = advanceRunners(bases, "BB"); awayScore += r; curPHome.stats.er += r;
            } else if(Math.random() < bbP + soP) {
                outs++; b.stats.so++; curPHome.stats.so++; curPHome.stats.ipOuts++;
            } else {
                let hitP = Math.max(0.24, 0.35 - ((curPHome.h9-65)*0.0015));
                if(Math.random() < hitP) {
                    b.stats.hits++; let isHR = Math.random() < (b.barrel/100 * BALANCING_CONFIG.batting.hrMultiplier);
                    let r = advanceRunners(bases, isHR ? "HR" : "1B"); awayScore += r; curPHome.stats.er += r; if(isHR) b.stats.hr++;
                } else { outs++; curPHome.stats.ipOuts++; }
            }
            awayOrder++;
        }
        // 裏の攻撃
        outs = 0; bases = [false, false, false];
        while (outs < 3) {
            if(pitchAway > curPAway.staMax || (inning >= 7 && awayScore - homeScore <= 2)) {
                let nextP = away.pitchers.find(p => (p.role === (inning === 9 ? "守護神" : "リリーフ")) && p.staCurrent > 15 && p !== curPAway);
                if(nextP) { curPAway = nextP; pitchAway = 0; curPAway.stats.appearances++; }
            }
            let b = lineupHome[(homeOrder-1)%9]; 
            b.stats.ab++; b.stats.games = (b.stats.games || 0) + 1;
            pitchAway += 4;
            
            let bbP = (b.bb/100)*BALANCING_CONFIG.plates.bbBaseScale + ((100-curPAway.bb9)*BALANCING_CONFIG.plates.bbPitcherScale);
            let soP = ((b.so/100)*BALANCING_CONFIG.plates.soBaseScale) + ((curPAway.k9*BALANCING_CONFIG.plates.soPitcherScale));
            
            if(Math.random() < bbP) {
                b.stats.bb++; curPAway.stats.bb++; let r = advanceRunners(bases, "BB"); homeScore += r; curPAway.stats.er += r;
            } else if(Math.random() < bbP + soP) {
                outs++; b.stats.so++; curPAway.stats.so++; curPAway.stats.ipOuts++;
            } else {
                let hitP = Math.max(0.24, 0.35 - ((curPAway.h9-65)*0.0015));
                if(Math.random() < hitP) {
                    b.stats.hits++; let isHR = Math.random() < (b.barrel/100 * BALANCING_CONFIG.batting.hrMultiplier);
                    let r = advanceRunners(bases, isHR ? "HR" : "1B"); homeScore += r; curPAway.stats.er += r; if(isHR) b.stats.hr++;
                } else { outs++; curPAway.stats.ipOuts++; }
            }
            homeOrder++;
        }
    }
    
    if(awayScore > homeScore) { away.wins++; home.losses++; curPAway.stats.wins++; curPHome.stats.losses++; }
    else if(homeScore > awayScore) { home.wins++; away.losses++; curPHome.stats.wins++; curPAway.stats.losses++; }
    else { away.draws++; home.draws++; }
    
    away.pitchers.forEach(p => { if(p.stats.ipOuts>0) p.stats.era = (p.stats.er * 27) / p.stats.ipOuts; });
    home.pitchers.forEach(p => { if(p.stats.ipOuts>0) p.stats.era = (p.stats.er * 27) / p.stats.ipOuts; });
    
    away.rotationIdx++; home.rotationIdx++;
    return `${away.name} ${awayScore} - ${homeScore} ${home.name}`;
}


function simulateRound() {
    if (totalGamesPlayed === -1) return null;
    if (totalGamesPlayed >= MAX_GAMES) {
        totalGamesPlayed = -1; 
        processOffseasonEvolution(); 
        executeOffseasonRosterEvents(); 
        return null; 
    }
    changeAllPlayersCondition(); 
    executeFrontOfficeAI();
    let pattern = getDynamicSchedule(totalGamesPlayed);
    let roundResults = [];
    pattern.forEach(pair => {
        let res = executeMatchLogic(teams[pair[0]], teams[pair[1]]);
        roundResults.push(res);
    });
    teams.forEach(t => { t.pitchers.forEach(p => { let rec = p.role.includes("二軍") ? 15 : 1.8; if(p.staCurrent < p.staMax) p.staCurrent = Math.min(p.staMax, p.staCurrent + rec); }); });
    totalGamesPlayed++; 
    return roundResults;
}

function playNextRound() {
    if (totalGamesPlayed === -1) return;
    let res = simulateRound(); 
    if (res === null) return; 
    let rEl = document.getElementById("quick_match_results");
    if(rEl) rEl.innerHTML = res.map(r => `<tr><td><b>${r}</b></td></tr>`).join("");
    updateUIAll();
}

function playOneWeek() {
    if (totalGamesPlayed === -1) return;
    let lastRes = null;
    for(let i=0; i<6; i++) { 
        if (totalGamesPlayed === -1) break;
        let res = simulateRound(); 
        if(res) lastRes = res; 
    }
    if (totalGamesPlayed === -1) return;
    if(lastRes) {
        let rEl = document.getElementById("quick_match_results");
        if(rEl) rEl.innerHTML = "<tr><td style='color:green;'><b>一週間分(6カード)を一括消化しました</b></td></tr>" + lastRes.map(r => `<tr><td>${r}</td></tr>`).join("");
    }
    updateUIAll();
}

function playAllSeason() {
    if (totalGamesPlayed === -1) return;
    while(totalGamesPlayed < MAX_GAMES && totalGamesPlayed !== -1) { 
        simulateRound(); 
    }
    if (totalGamesPlayed === -1) return;
    updateUIAll();
}

function resetSeason() { 
    totalGamesPlayed = 0; 
    currentYear = 1; 
    initializeLeagueData(); 
    updateUIAll(); 
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
    
    let formPos = document.getElementById("form_pos");
    if (formPos) {
        for (let i = 0; i < formPos.options.length; i++) {
            formPos.options[i].disabled = false; 
        }
        if (type === "bat") {
            for (let i = 0; i < formPos.options.length; i++) {
                let optVal = formPos.options[i].value;
                let isMain = (player.originalPos === optVal);
                let isSub = (player.subPositions && player.subPositions.includes(optVal));
                if (!isMain && !isSub) formPos.options[i].disabled = true;
            }
        } else {
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
    gameCountEl.innerText = totalGamesPlayed === -1 ? 143 : totalGamesPlayed;
    
    teams.forEach(t => {
        t.batters.forEach(b => {
            if(!b.stats.ab) { b.stats.war = 0.0; return; }
            let avg = b.stats.hits / b.stats.ab;
            let batVal = (avg - 0.255) * 8 + (b.stats.hr * 0.15) + (b.stats.bb * 0.04);
            let defVal = (b.uzr || 0) * 0.05;
            b.stats.war = (batVal + defVal) * (b.stats.ab / 450);
        });
        t.pitchers.forEach(p => {
            if(!p.stats.ipOuts) { p.stats.war = 0.0; return; }
            let ip = p.stats.ipOuts / 3;
            let eraBuff = (4.20 - (p.stats.era || 4.20)) * (ip / 150) * 2.5;
            p.stats.war = eraBuff + (p.stats.wins * 0.1) - (p.stats.losses * 0.05) + (p.stats.saves * 0.08);
        });
    });

    let sorted = [...teams].sort((a,b) => (b.wins/(b.wins+b.losses||1)) - (a.wins/(a.wins+a.losses||1)));
    let sBody = document.getElementById("standings_body"); sBody.innerHTML = "";
    sorted.forEach((t, i) => {
        let wp = t.wins / (t.wins+t.losses||1);
        let rowStyle = (t.id === userTeamId) ? `style="background-color: #e0f2fe; font-weight:bold;"` : "";
        sBody.innerHTML += `<tr ${rowStyle}><td>${i+1}</td><td>${t.name}</td><td>${t.wins}</td><td>${t.losses}</td><td>${t.draws}</td><td>${wp.toFixed(3)}</td><td>-</td></tr>`;
    });

    let batBody = document.querySelector("#batting_stats_table tbody");
    if(batBody) {
        let bList = []; teams.forEach(t => t.batters.forEach(b => bList.push({tName: t.name, data: b})));
        bList.sort((a,b) => b.data.stats.war - a.data.stats.war);
        batBody.innerHTML = "";
        bList.slice(0, 15).forEach(item => {
            let b = item.data; let avg = b.stats.hits / (b.stats.ab || 1);
            batBody.innerHTML += `<tr><td>${item.tName}</td><td><b>${b.name}</b></td><td>${b.currentPos}</td><td>${avg.toFixed(3)}</td><td>${b.stats.games}</td><td>${b.stats.ab}</td><td>${b.stats.hits}</td><td>${b.stats.hr}</td><td>${b.stats.rbi}</td><td>${b.stats.war.toFixed(1)}</td></tr>`;
        });
    }

    let pitBody = document.querySelector("#pitching_stats_table tbody");
    if(pitBody) {
        let pList = []; teams.forEach(t => pList.push(...t.pitchers));
        pList.sort((a,b) => b.stats.war - a.stats.war);
        pitBody.innerHTML = "";
        pList.slice(0, 15).forEach(p => {
            let tName = teams.find(t => t.pitchers.includes(p)).name;
            // 🛠️【完全修復】文字列バグを排除し、正しい変数展開関数に書き換え
            pitBody.innerHTML += `<tr><td>${tName}</td><td><b>${p.name}</b></td><td>${p.role}</td><td>${p.stats.ipOuts > 0 ? p.stats.era.toFixed(2) : '-.--'}</td><td>${p.stats.appearances}</td><td>${p.stats.wins}</td><td>${p.stats.losses}</td><td>${p.stats.saves}</td><td>${formatInningsPitched(p.stats.ipOuts)}</td><td>${p.staCurrent.toFixed(0)}</td><td>${p.stats.war.toFixed(1)}</td></tr>`;
        });
    }
}

function switchTab(tabId, el) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    let targetContent = document.getElementById(tabId);
    if(targetContent) targetContent.classList.add('active');
    if(el) el.classList.add('active');
}

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

