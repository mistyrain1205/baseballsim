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
    document.getElementById("draft_status_message").innerHTML = "📢 <b>オフシーズン・球団人員整理フェーズ</b>。不要な選手に戦力外通告を行ってください。";
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

function executeMatchLogic(away, home) {
    let awayStarters = away.pitchers.filter(p => p.role === "先発");
    let homeStarters = home.pitchers.filter(p => p.role === "先発");
    let pAway = awayStarters[away.rotationIdx % awayStarters.length] || away.pitchers[0];
    let pHome = homeStarters[home.rotationIdx % homeStarters.length] || home.pitchers[0];
    
    pAway.staCurrent = pAway.staMax; 
    pHome.staCurrent = pHome.staMax;

    let curPitcherAway = pAway; 
    let curPitcherHome = pHome;
    curPitcherAway.stats.appearances++; 
    curPitcherHome.stats.appearances++;
    
    pAway.exp = (pAway.exp || 0) + 15; 
    pHome.exp = (pHome.exp || 0) + 15;

    let appearedAway = [pAway.name]; 
    let appearedHome = [pHome.name];
    let awayScore = 0, homeScore = 0; 
    let awayOrder = 1; 
    let homeOrder = 1; 
    let pitchCountAway = 0, pitchCountHome = 0;
    
    let pitcherMatchStats = {};
    const initMatchStat = (name) => {
        if (!pitcherMatchStats[name]) pitcherMatchStats[name] = { er: 0, outs: 0 };
    };
    initMatchStat(pAway.name);
    initMatchStat(pHome.name);

    for (let inning = 1; inning <= 9; inning++) {
        let outs = 0; 
        let bases = [false, false, false];
        while (outs < 3) {
            let needChange = false;
            
            if (inning === 9 && curPitcherHome.role !== "守護神") {
                let scoreDiff = homeScore - awayScore;
                if (scoreDiff >= 0 && scoreDiff <= 3) {
                    let closer = home.pitchers.find(p => p.role === "守護神" && p.staCurrent >= 15);
                    if (closer) { 
                        curPitcherHome = closer; 
                        if (!appearedHome.includes(closer.name)) { 
                            closer.stats.appearances++; 
                            appearedHome.push(closer.name); 
                            closer.exp = (closer.exp||0)+10;
                        } 
                        pitchCountHome = 0; 
                        initMatchStat(closer.name);
                    }
                }
            }
            
            if (curPitcherHome.role !== "守護神" && (inning === 7 || inning === 8)) {
                let scoreDiff = homeScore - awayScore;
                if (scoreDiff >= -1 && scoreDiff <= 2 && curPitcherHome.role === "先発") needChange = true;
            }
            
            if (curPitcherHome.role !== "守護神") {
                if (pitchCountHome >= curPitcherHome.staMax || pitcherMatchStats[curPitcherHome.name].er >= 4) needChange = true;
            } else { 
                if (pitcherMatchStats[curPitcherHome.name].er >= 2) needChange = true; 
            }

            if (needChange) {
                let available = home.pitchers.filter(p => p.role === "リリーフ" && p.staCurrent >= 20 && !appearedHome.includes(p.name));
                if (available.length === 0) {
                    available = home.pitchers.filter(p => p.role.includes("リリーフ") && p.staCurrent > 5);
                }
                
                if (available.length > 0) { 
                    available.sort((a, b) => (b.staCurrent * getConditionModifier(b.condition, "batBarrel")) - (a.staCurrent * getConditionModifier(a.condition, "batBarrel")));
                    curPitcherHome = available[0]; 
                    if (!appearedHome.includes(curPitcherHome.name)) { 
                        curPitcherHome.stats.appearances++; 
                        appearedHome.push(curPitcherHome.name); 
                    } 
                    pitchCountHome = 0; 
                    initMatchStat(curPitcherHome.name);
                }
            }
            
            let currentBatters = away.batters.filter(bat => bat.role === awayOrder);
            let b = currentBatters[0];
            
            if(!b) {
                reassignTeamRoles(away);
                b = away.batters.find(bat => bat.role === awayOrder) || away.batters[0];
            }

            b.stats.ab++;
            pitchCountHome += 4; 
            b.stats.games = (b.stats.games || 0) + 1;
            
            let batConditionMod = getConditionModifier(b.condition, "batSo");
            let pitConditionMod = getConditionModifier(curPitcherHome.condition, "pitPitch"); 
            
            let bbP = (b.bb / 100) * BALANCING_CONFIG.plates.bbBaseScale + ((100 - curPitcherHome.bb9) * BALANCING_CONFIG.plates.bbPitcherScale); 
            let soP = ((b.so / 100) * BALANCING_CONFIG.plates.soBaseScale * batConditionMod) + ((curPitcherHome.k9 * BALANCING_CONFIG.plates.soPitcherScale) * pitConditionMod); 
            let rand = Math.random();
            
            if(rand < bbP) {
                b.stats.bb++; curPitcherHome.stats.bb++; 
                let runs = advanceRunners(bases, "BB");
                awayScore += runs; 
                curPitcherHome.stats.er += runs; 
                pitcherMatchStats[curPitcherHome.name].er += runs;
            } else if(rand < bbP + soP) {
                outs++; b.stats.so++; curPitcherHome.stats.so++;
                curPitcherHome.stats.ipOuts = (curPitcherHome.stats.ipOuts || 0) + 1;
                pitcherMatchStats[curPitcherHome.name].outs += 1;
            } else {
                let baseHitChance = BALANCING_CONFIG.batting.baseHitChance; 
                let h9Effect = ((curPitcherHome.h9 - 65) * BALANCING_CONFIG.batting.pitcherH9Influence) * pitConditionMod; 
                let finalHitChance = Math.max(0.24, Math.min(0.48, baseHitChance - h9Effect));
                
                if (Math.random() < finalHitChance) {
                    b.stats.hits++; b.exp = (b.exp || 0) + 2;
                    let hr9Reduction = ((curPitcherHome.hr9 / 100) * BALANCING_CONFIG.batting.pitcherHr9Influence) * pitConditionMod;
                    let finalBarrel = ((b.barrel / 100) * getConditionModifier(b.condition, "batBarrel")) * (1 - hr9Reduction);
                    
                    let isHR = Math.random() < (finalBarrel * BALANCING_CONFIG.batting.hrMultiplier); 
                    let runs = advanceRunners(bases, isHR ? "HR" : "1B");
                    awayScore += runs; 
                    curPitcherHome.stats.er += runs; 
                    pitcherMatchStats[curPitcherHome.name].er += runs;
                    if(isHR) b.stats.hr++;
                } else {
                    outs++; 
                    curPitcherHome.stats.ipOuts = (curPitcherHome.stats.ipOuts || 0) + 1;
                    pitcherMatchStats[curPitcherHome.name].outs += 1;
                }
            }
            awayOrder = (awayOrder % 9) + 1;
        }

        // --- 裏の攻撃 (Home) ---
        outs = 0; 
        bases = [false, false, false];
        while (outs < 3) {
            let needChange = false;
            if (inning === 9 && curPitcherAway.role !== "守護神") {
                let scoreDiff = awayScore - homeScore;
                if (scoreDiff >= 0 && scoreDiff <= 3) {
                    let closer = away.pitchers.find(p => p.role === "守護神" && p.staCurrent >= 15);
                    if (closer) { 
                        curPitcherAway = closer; 
                        if (!appearedAway.includes(closer.name)) { 
                            closer.stats.appearances++; 
                            appearedAway.push(closer.name); 
                            closer.exp = (closer.exp||0)+10;
                        } 
                        pitchCountAway = 0; 
                        initMatchStat(closer.name);
                    }
                }
            }
            if (curPitcherAway.role !== "守護神" && (inning === 7 || inning === 8)) {
                let scoreDiff = awayScore - homeScore;
                if (scoreDiff >= -1 && scoreDiff <= 2 && curPitcherAway.role === "先発") needChange = true;
            }
            if (curPitcherAway.role !== "守護神") {
                if (pitchCountAway >= curPitcherAway.staMax || pitcherMatchStats[curPitcherAway.name].er >= 4) needChange = true;
            } else { 
                if (pitcherMatchStats[curPitcherAway.name].er >= 2) needChange = true; 
            }

            if (needChange) {
                let available = away.pitchers.filter(p => p.role === "リリーフ" && p.staCurrent >= 20 && !appearedAway.includes(p.name));
                if (available.length === 0) {
                    available = away.pitchers.filter(p => p.role.includes("リリーフ") && p.staCurrent > 5);
                }
                
                if (available.length > 0) { 
                    available.sort((a, b) => (b.staCurrent * getConditionModifier(b.condition, "batBarrel")) - (a.staCurrent * getConditionModifier(a.condition, "batBarrel")));
                    curPitcherAway = available[0]; 
                    if (!appearedAway.includes(curPitcherAway.name)) { 
                        curPitcherAway.stats.appearances++; 
                        appearedAway.push(curPitcherAway.name); 
                    } 
                    pitchCountAway = 0; 
                    initMatchStat(curPitcherAway.name);
                }
            }
            
            let currentBattersHome = home.batters.filter(bat => bat.role === homeOrder);
            let b = currentBattersHome[0];
            
            if(!b) {
                reassignTeamRoles(home);
                b = home.batters.find(bat => bat.role === homeOrder) || home.batters[0];
            }

            b.stats.ab++;
            pitchCountAway += 4; 
            b.stats.games = (b.stats.games || 0) + 1;
            
            let batConditionMod = getConditionModifier(b.condition, "batSo");
            let pitConditionMod = getConditionModifier(curPitcherAway.condition, "pitPitch");
            
            let bbP = (b.bb / 100) * BALANCING_CONFIG.plates.bbBaseScale + ((100 - curPitcherAway.bb9) * BALANCING_CONFIG.plates.bbPitcherScale);
            let soP = ((b.so / 100) * BALANCING_CONFIG.plates.soBaseScale * batConditionMod) + ((curPitcherAway.k9 * BALANCING_CONFIG.plates.soPitcherScale) * pitConditionMod);
            let rand = Math.random();
            
            if(rand < bbP) {
                b.stats.bb++; curPitcherAway.stats.bb++; 
                let runs = advanceRunners(bases, "BB");
                homeScore += runs; 
                curPitcherAway.stats.er += runs; 
                pitcherMatchStats[curPitcherAway.name].er += runs;
            } else if(rand < bbP + soP) {
                outs++; b.stats.so++; curPitcherAway.stats.so++;
                curPitcherAway.stats.ipOuts = (curPitcherAway.stats.ipOuts || 0) + 1;
                pitcherMatchStats[curPitcherAway.name].outs += 1;
            } else {
                let baseHitChance = BALANCING_CONFIG.batting.baseHitChance;
                let h9Effect = ((curPitcherAway.h9 - 65) * BALANCING_CONFIG.batting.pitcherH9Influence) * pitConditionMod;
                let finalHitChance = Math.max(0.24, Math.min(0.45, baseHitChance - h9Effect));
                
                if (Math.random() < finalHitChance) {
                    b.stats.hits++; b.exp = (b.exp || 0) + 2;
                    let hr9Reduction = ((curPitcherAway.hr9 / 100) * BALANCING_CONFIG.batting.pitcherHr9Influence) * pitConditionMod;
                    let finalBarrel = ((b.barrel / 100) * getConditionModifier(b.condition, "batBarrel")) * (1 - hr9Reduction);
                    
                    let isHR = Math.random() < (finalBarrel * BALANCING_CONFIG.batting.hrMultiplier);
                    let runs = advanceRunners(bases, isHR ? "HR" : "1B");
                    homeScore += runs; 
                    curPitcherAway.stats.er += runs; 
                    pitcherMatchStats[curPitcherAway.name].er += runs;
                    if(isHR) b.stats.hr++;
                } else {
                    outs++;
                    curPitcherAway.stats.ipOuts = (curPitcherAway.stats.ipOuts || 0) + 1;
                    pitcherMatchStats[curPitcherAway.name].outs += 1;
                }
            }
            homeOrder = (homeOrder % 9) + 1;
        }
    }

    if(awayScore > homeScore) { 
        away.wins++; home.losses++; 
    } else if(homeScore > awayScore) { 
        home.wins++; away.losses++; 
    } else { 
        away.draws++; home.draws++; 
    }

    away.pitchers.forEach(p => { 
        if (appearedAway.includes(p.name)) {
            let matchOuts = pitcherMatchStats[p.name] ? pitcherMatchStats[p.name].outs : 0;
            let cost = p.role === "先発" ? 0 : (10 + matchOuts * 4); 
            if(p.role !== "先発") p.staCurrent = Math.max(0, p.staCurrent - cost);
        } 
    });
    home.pitchers.forEach(p => { 
        if (appearedHome.includes(p.name)) {
            let matchOuts = pitcherMatchStats[p.name] ? pitcherMatchStats[p.name].outs : 0;
            let cost = p.role === "先発" ? 0 : (10 + matchOuts * 4);
            if(p.role !== "先発") p.staCurrent = Math.max(0, p.staCurrent - cost);
        } 
    });
    
    away.pitchers.forEach(p => { if (p.stats.ipOuts > 0) p.stats.era = (p.stats.er * 27) / p.stats.ipOuts; });
    home.pitchers.forEach(p => { if (p.stats.ipOuts > 0) p.stats.era = (p.stats.er * 27) / p.stats.ipOuts; });

    away.rotationIdx++; 
    home.rotationIdx++;
    return `${away.name} ${awayScore} - ${homeScore} ${home.name}`;
}

function simulateRound() {
    if (totalGamesPlayed === -1) {
        alert("現在はオフシーズン補強中です！「オフシーズン補強」タブから戦力外通告またはドラフト指名を完了させてください。");
        return null;
    }

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
    
    let weekCountEl = document.getElementById("current_week_count");
    if(weekCountEl) {
        weekCountEl.innerText = totalGamesPlayed === -1 ? 24 : Math.floor(totalGamesPlayed / 6) + 1;
    }
    
    let h2Title = document.querySelector(".card h2");
    if(h2Title && !h2Title.innerText.includes("就任")) {
        let displayGame = totalGamesPlayed === -1 ? 143 : totalGamesPlayed;
        let displayWeek = totalGamesPlayed === -1 ? 24 : Math.floor(totalGamesPlayed / 6) + 1;
        h2Title.innerHTML = `リーグ消化状況: <span id="current_game_count">${displayGame}</span> / 143 試合 (第 <span id="current_week_count">${displayWeek}</span> 週目)`;
    }

    // 🔥【リアルタイムWAR自動シミュレート＆算出ロジック】
    teams.forEach(t => {
        t.batters.forEach(b => {
            if(!b.stats.ab) { b.stats.war = 0.0; return; }
            let avg = b.stats.hits / b.stats.ab;
            let batContribution = (avg - 0.250) * 15 + (b.stats.hr * 0.2) + (b.stats.bb * 0.08);
            let defContribution = (b.uzr || 0) * 0.08;
            b.stats.war = Math.max(-2.5, batContribution + defContribution);
        });
        t.pitchers.forEach(p => {
            if(!p.stats.ipOuts) { p.stats.war = 0.0; return; }
            let ip = p.stats.ipOuts / 3;
            let replacementEra = p.role.includes("先発") ? 4.50 : 3.80;
            let eraDiff = replacementEra - (p.stats.era || 4.50);
            let scale = p.role.includes("先発") ? 0.08 : 0.18;
            p.stats.war = Math.max(-1.5, (eraDiff * ip * scale) + (p.stats.so * 0.015) + (p.stats.saves * 0.1));
        });
    });

    let sorted = [...teams].sort((a,b) => (b.wins / ((b.wins + b.losses) || 1)) - (a.wins / ((a.wins + a.losses) || 1)));
    let sBody = document.getElementById("standings_body"); sBody.innerHTML = "";
    sorted.forEach((t, i) => {
        let wp = t.wins / ((t.wins + t.losses) || 1);
        let isMyTeam = (t.id === userTeamId);
        let teamDisplay = isMyTeam ? `<span style="color:#e53e3e;">★</span>${t.name}` : t.name;
        let rowStyle = isMyTeam ? `style="background-color: #e0f2fe; font-weight:bold;"` : ""; 
        sBody.innerHTML += `<tr ${rowStyle}><td>${i+1}</td><td><b>${teamDisplay}</b></td><td>${t.wins}</td><td>${t.losses}</td><td>${t.draws}</td><td>${wp.toFixed(3)}</td><td>-</td></tr>`;
    });

    // 個人打撃成績テーブルヘッダーに「WAR」を組み込んで拡張
    let batHeader = document.querySelector("#batting_stats_table ready");
    let batBody = document.querySelector("#batting_stats_table tbody"); 
    if(batBody) {
        let bList = []; teams.forEach(t => t.batters.forEach(b => bList.push({tName: t.name, data: b})));
        bList.sort((a,b) => (b.data.stats.hits / (b.data.stats.ab || 1)) - (a.data.stats.hits / (a.data.stats.ab || 1)));
        batBody.innerHTML = "";
        // 各自、WAR列の表示を追加
        document.querySelector("#batting_stats_table thead tr").innerHTML = `<th>球団</th><th>選手名</th><th>守備</th><th>打率</th><th>試合</th><th>打数</th><th>安打</th><th>本塁打</th><th>打点</th><th>WAR</th>`;
        bList.slice(0, 15).forEach(item => {
            let b = item.data; let avg = b.stats.hits / (b.stats.ab || 1);
            let wColor = b.stats.war >= 3.0 ? "color:green; font-weight:bold;" : (b.stats.war < 0 ? "color:red;" : "");
            batBody.innerHTML += `<tr><td>${item.tName}</td><td><b>${b.name} (${b.age}歳)</b></td><td>${b.currentPos}</td><td>${avg.toFixed(3)}</td><td>${b.stats.games}</td><td>${b.stats.ab}</td><td>${b.stats.hits}</td><td>${b.stats.hr}</td><td>${b.stats.rbi}</td><td style="${wColor}">${b.stats.war.toFixed(1)}</td></tr>`;
        });
    }

    // 個人投手成績テーブルヘッダーに「WAR」を組み込んで拡張
    let pitBody = document.querySelector("#pitching_stats_table tbody"); 
    if(pitBody) {
        let pList = []; teams.forEach(t => pList.push(...t.pitchers));
        pList.sort((a,b) => { if(a.stats.ipOuts === 0) return 1; if(b.stats.ipOuts === 0) return -1; return a.stats.era - b.stats.era; });
        document.querySelector("#pitching_stats_table thead tr").innerHTML = `<th>球団</th><th>選手名</th><th>役割</th><th>防御率</th><th>登板</th><th>勝</th><th>敗</th><th>セーブ</th><th>投球回</th><th>残りSTA</th><th>WAR</th>`;
        pitBody.innerHTML = "";
        pList.forEach(p => {
            let tObj = teams.find(t => t.pitchers.some(pObj => pObj.name === p.name));
            let tName = tObj ? tObj.name : "";
            let wColor = p.stats.war >= 2.0 ? "color:green; font-weight:bold;" : (p.stats.war < 0 ? "color:red;" : "");
            pitBody.innerHTML += `<tr><td>${tName}</td><td><b>${p.name} (${p.age}歳)</b></td><td>${p.role}</td><td><b>${p.stats.ipOuts > 0 ? p.stats.era.toFixed(2) : '-.--'}</b></td><td>${p.stats.appearances}</td><td>${p.stats.wins}</td><td>${p.stats.losses}</td><td><b>${p.stats.saves}</b></td><td>${formatInningsPitched(p.stats.ipOuts)}</td><td>${p.staCurrent}</td><td style="${wColor}">${p.stats.war.toFixed(1)}</td></tr>`;
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
