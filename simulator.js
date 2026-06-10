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
    const fixedPos = ["捕手", "一塁手", "二塁手", "三塁手", "遊撃手", "左翼手", "中堅手", "右翼手"];
    t.batters.forEach(b => b.role = -1);
    fixedPos.forEach((pos, idx) => {
        let candidate = t.batters.find(b => b.role === -1 && (b.originalPos === pos || (b.subPositions && b.subPositions.includes(pos))));
        if (candidate) { candidate.role = idx + 1; candidate.currentPos = pos; }
    });
    fixedPos.forEach((pos, idx) => {
        if (!t.batters.some(b => b.role === (idx + 1))) {
            let backup = t.batters.find(b => b.role === -1);
            if (backup) { backup.role = idx + 1; backup.currentPos = pos; }
        }
    });
    let rCount = 0;
    t.batters.forEach(b => {
        if (b.role > 0) return;
        if (rCount < 7) { b.role = 0; rCount++; } else { b.role = -1; }
        b.currentPos = b.originalPos; 
    });
    t.pitchers.forEach((p, idx) => {
        if (p.role === "先発" || p.role === "守護神" || p.role === "二軍先発") { p.staCurrent = p.staMax; return; }
        if (idx < 12) { if (p.role !== "先発" && p.role !== "守護神") p.role = "リリーフ"; }
        else { if (p.role !== "二軍先発") p.role = "二軍リリーフ"; }
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

// ==========================================
// 3. 試合進行・シミュレーション中枢（個人勝敗・交代AI搭載）
// ==========================================
function executeMatchLogic(away, home) {
    let awayStarters = away.pitchers.filter(p => p.role === "先発");
    let homeStarters = home.pitchers.filter(p => p.role === "先発");
    let pAway = awayStarters[away.rotationIdx % awayStarters.length] || away.pitchers[0];
    let pHome = homeStarters[home.rotationIdx % homeStarters.length] || home.pitchers[0];
    
    let curPAway = pAway; let curPHome = pHome;
    curPAway.stats.appearances++; curPHome.stats.appearances++;
    
    let appearedAway = [curPAway]; let appearedHome = [curPHome];
    let awayScore = 0, homeScore = 0;
    let awayOrder = 1; let homeOrder = 1;
    let pitchAway = 0; let pitchHome = 0;
    
    // 勝敗投手判定用データ
    let leadHistory = []; // {leadTeam: teamObj, pitcher: pitcherObj}
    let pitcherMatchStats = new Map();
    const initPS = (p) => { if(!pitcherMatchStats.has(p.name)) pitcherMatchStats.set(p.name, {er:0, outs:0}); };
    initPS(curPAway); initPS(curPHome);

    // 野手交代AI（スタメンが絶不調なら控えと入れ替えて試合に臨む）
    const getGameLineup = (team) => {
        let lineup = [];
        for(let i=1; i<=9; i++) {
            let s = team.batters.find(b => b.role === i);
            if(s && s.condition === "絶不調" && Math.random() < 0.7) {
                let sub = team.batters.find(b => b.role === 0 && b.condition !== "絶不調");
                lineup.push(sub || s);
            } else { lineup.push(s || team.batters[0]); }
        }
        return lineup;
    };
    let lineupAway = getGameLineup(away);
    let lineupHome = getGameLineup(home);

    for (let inning = 1; inning <= 9; inning++) {
        // 表の攻撃
        let outs = 0; let bases = [false, false, false];
        while (outs < 3) {
            // 投手交代チェック(Home)
            if(pitchHome > curPHome.staMax || (inning >= 7 && homeScore - awayScore <= 2)) {
                let nextP = home.pitchers.find(p => (p.role === (inning === 9 ? "守護神" : "リリーフ")) && p.staCurrent > 15 && !appearedHome.includes(p));
                if(nextP) { curPHome = nextP; appearedHome.push(nextP); pitchHome = 0; curPHome.stats.appearances++; initPS(nextP); }
            }
            let b = lineupAway[(awayOrder-1)%9];
            b.stats.ab++; b.stats.games = (b.stats.games || 0) + 1;
            pitchHome += 4;
            let rand = Math.random();
            let bbP = (b.bb/100)*BALANCING_CONFIG.plates.bbBaseScale + ((100-curPHome.bb9)*BALANCING_CONFIG.plates.bbPitcherScale);
            let soP = ((b.so/100)*BALANCING_CONFIG.plates.soBaseScale) + ((curPHome.k9*BALANCING_CONFIG.plates.soPitcherScale));
            
            if(rand < bbP) {
                b.stats.bb++; curPHome.stats.bb++; 
                let r = advanceRunners(bases, "BB"); awayScore += r; curPHome.stats.er += r; pitcherMatchStats.get(curPHome.name).er += r;
            } else if(rand < bbP + soP) {
                outs++; b.stats.so++; curPHome.stats.so++; curPHome.stats.ipOuts++; pitcherMatchStats.get(curPHome.name).outs++;
            } else {
                let hitP = Math.max(0.24, 0.35 - ((curPHome.h9-65)*0.0015));
                if(Math.random() < hitP) {
                    b.stats.hits++; let isHR = Math.random() < (b.barrel/100 * BALANCING_CONFIG.batting.hrMultiplier);
                    let r = advanceRunners(bases, isHR ? "HR" : "1B"); awayScore += r; curPHome.stats.er += r; 
                    pitcherMatchStats.get(curPHome.name).er += r; if(isHR) b.stats.hr++;
                } else { outs++; curPHome.stats.ipOuts++; pitcherMatchStats.get(curPHome.name).outs++; }
            }
            if(awayScore > homeScore) leadHistory.push({team: "away", pitcher: curPAway});
            awayOrder++;
        }
        // 裏の攻撃
        outs = 0; bases = [false, false, false];
        while (outs < 3) {
            // 投手交代チェック(Away)
            if(pitchAway > curPAway.staMax || (inning >= 7 && awayScore - homeScore <= 2)) {
                let nextP = away.pitchers.find(p => (p.role === (inning === 9 ? "守護神" : "リリーフ")) && p.staCurrent > 15 && !appearedAway.includes(p));
                if(nextP) { curPAway = nextP; appearedAway.push(nextP); pitchAway = 0; curPAway.stats.appearances++; initPS(nextP); }
            }
            let b = lineupHome[(homeOrder-1)%9];
            b.stats.ab++; b.stats.games = (b.stats.games || 0) + 1;
            pitchAway += 4;
            let rand = Math.random();
            let bbP = (b.bb/100)*BALANCING_CONFIG.plates.bbBaseScale + ((100-curPAway.bb9)*BALANCING_CONFIG.plates.bbPitcherScale);
            let soP = ((b.so/100)*BALANCING_CONFIG.plates.soBaseScale) + ((curPAway.k9*BALANCING_CONFIG.plates.soPitcherScale));
            if(rand < bbP) {
                b.stats.bb++; curPAway.stats.bb++;
                let r = advanceRunners(bases, "BB"); homeScore += r; curPAway.stats.er += r; pitcherMatchStats.get(curPAway.name).er += r;
            } else if(rand < bbP + soP) {
                outs++; b.stats.so++; curPAway.stats.so++; curPAway.stats.ipOuts++; pitcherMatchStats.get(curPAway.name).outs++;
            } else {
                let hitP = Math.max(0.24, 0.35 - ((curPAway.h9-65)*0.0015));
                if(Math.random() < hitP) {
                    b.stats.hits++; let isHR = Math.random() < (b.barrel/100 * BALANCING_CONFIG.batting.hrMultiplier);
                    let r = advanceRunners(bases, isHR ? "HR" : "1B"); homeScore += r; curPAway.stats.er += r;
                    pitcherMatchStats.get(curPAway.name).er += r; if(isHR) b.stats.hr++;
                } else { outs++; curPAway.stats.ipOuts++; pitcherMatchStats.get(curPAway.name).outs++; }
            }
            if(homeScore > awayScore) leadHistory.push({team: "home", pitcher: curPHome});
            homeOrder++;
        }
    }

    // 勝敗付け
    if(awayScore > homeScore) {
        away.wins++; home.losses++;
        let winP = appearedAway[0]; // 暫定で先発
        let loseP = appearedHome[0];
        winP.stats.wins++; loseP.stats.losses++;
        if(homeScore >= awayScore - 3 && appearedAway.length > 1) appearedAway[appearedAway.length-1].stats.saves++;
    } else if(homeScore > awayScore) {
        home.wins++; away.losses++;
        let winP = appearedHome[0];
        let loseP = appearedAway[0];
        winP.stats.wins++; loseP.stats.losses++;
        if(awayScore >= homeScore - 3 && appearedHome.length > 1) appearedHome[appearedHome.length-1].stats.saves++;
    } else { away.draws++; home.draws++; }

    // スタミナ消費
    appearedAway.forEach(p => { if(p.role!=="先発") p.staCurrent = Math.max(0, p.staCurrent - (15 + pitcherMatchStats.get(p.name).outs*2)); });
    appearedHome.forEach(p => { if(p.role!=="先発") p.staCurrent = Math.max(0, p.staCurrent - (15 + pitcherMatchStats.get(p.name).outs*2)); });

    away.pitchers.forEach(p => { if(p.stats.ipOuts>0) p.stats.era = (p.stats.er * 27) / p.stats.ipOuts; });
    home.pitchers.forEach(p => { if(p.stats.ipOuts>0) p.stats.era = (p.stats.er * 27) / p.stats.ipOuts; });
    away.rotationIdx++; home.rotationIdx++;
    return `${away.name} ${awayScore} - ${homeScore} ${home.name}`;
}

function simulateRound() {
    // 【安全ロック】もし戦力外やドラフト中に進行ボタンが押されたらブロック
    if (totalGamesPlayed === -1) {
        alert("現在はオフシーズン補強中です！「オフシーズン補強」タブから戦力外通告またはドラフト指名を完了させてください。");
        return null;
    }

    // 143試合消化した瞬間の判定
    if (totalGamesPlayed >= MAX_GAMES) {
        // 🔥【オフシーズン突入ロック】
        // 試合数を一時的に「-1」に設定し、日程進行を完全にストップさせます。
        totalGamesPlayed = -1; 

        // オフシーズンの年齢増加と、既存プレイヤーの能力成長・衰退を行う
        processOffseasonEvolution(); 
        
        // 手動戦力外通告画面を起動
        executeOffseasonRosterEvents(); 
        
        // 🚨【超重要バグ修正】
        // ここで関数の処理を完全に終わらせます（return null）。
        // これにより、最下部にある「totalGamesPlayed++」が誤って暴発するのを100%防ぎます。
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
    
    // 通常のシーズン中のみ、日程カウントを進めて画面を更新
    totalGamesPlayed++; 
    updateUIAll();
    return roundResults;
}
function playNextRound() { simulateRound(); }
function playOneWeek() { for(let i=0; i<6; i++) simulateRound(); }
function playAllSeason() { while(totalGamesPlayed < MAX_GAMES && totalGamesPlayed !== -1) simulateRound(); }
function resetSeason() { totalGamesPlayed = 0; currentYear = 1; initializeLeagueData(); updateUIAll(); }

function updateUIAll() {
    let gameCountEl = document.getElementById("current_game_count");
    if(!gameCountEl) return;
    gameCountEl.innerText = totalGamesPlayed === -1 ? 143 : totalGamesPlayed;
    
    // WAR計算ロジック（デフレ調整済）
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
            pitBody.innerHTML += `<tr><td>${tName}</td><td><b>${p.name}</b></td><td>${p.role}</td><td>${p.stats.ipOuts > 0 ? p.stats.era.toFixed(2) : '-.--'}</td><td>${p.stats.appearances}</td><td>${p.stats.wins}</td><td>${p.stats.losses}</td><td>${p.stats.saves}</td><td>${formatInningsPitched(p.stats.ipOuts)}</td><td>${p.staCurrent.toFixed(0)}</td><td>${p.stats.war.toFixed(1)}</td></tr>`;
        });
    }
}

function switchTab(tabId, el) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active'); el.classList.add('active');
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
