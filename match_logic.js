// match_logic.js

// ==========================================
// 3. 試合進行・シミュレーション中枢
// ==========================================
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
        // --- 表の攻撃 (Away) ---
        let outs = 0; 
        let bases = [false, false, false];
        while (outs < 3) {
            let needChange = false;
            
            // 【修正】9回・守護神の登板判定（セーブシチュエーション、または同点の僅差のみ）
            if (inning === 9 && curPitcherHome.role !== "守護神") {
                let scoreDiff = homeScore - awayScore;
                // 3点リード以内、または同点の場合のみ守護神を出す（大勝時や大負け時は温存）
                if (scoreDiff >= 0 && scoreDiff <= 3) {
                    let closer = home.pitchers.find(p => p.role === "守護神" && p.staCurrent >= 20);
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
            
            // 7・8回の継投判定（先発がまだ投げていて、僅差の場合のセットアッパー選出）
            if (curPitcherHome.role !== "守護神" && (inning === 7 || inning === 8)) {
                let scoreDiff = homeScore - awayScore;
                if (scoreDiff >= -1 && scoreDiff <= 2 && curPitcherHome.role === "先発") {
                    needChange = true; // 僅差ならリリーフへスイッチ
                }
            }
            
            // 途中の通常継投判定（スタミナ切れ、または炎上）
            if (curPitcherHome.role !== "守護神") {
                if (pitchCountHome >= curPitcherHome.staMax || pitcherMatchStats[curPitcherHome.name].er >= 4) needChange = true;
            } else { 
                if (pitcherMatchStats[curPitcherHome.name].er >= 2) needChange = true; 
            }

            if (needChange) {
                // 【全員野球AI】一軍リリーフ全員（role === "リリーフ"）をプール
                let available = home.pitchers.filter(p => p.role === "リリーフ" && p.staCurrent >= 18 && !appearedHome.includes(p.name));
                
                if (available.length > 0) { 
                    // 【重要】スタミナ残量 ＋ 調子補正を計算し、その日一番「フレッシュで投げられる」投手を動的に選出！
                    // これにより、配列の先頭だけが使われるバグを完全に破壊し、ブルペン全員に均等にチャンスが回ります。
                    available.sort((a, b) => {
                        let scoreA = a.staCurrent * getConditionModifier(a.condition, "batBarrel"); // 調子が良いとスタミナ持ちが良い判定
                        let scoreB = b.staCurrent * getConditionModifier(b.condition, "batBarrel");
                        return scoreB - scoreA; // スコアが高い（元気な）順
                    });
                    
                    curPitcherHome = available[0]; 
                    if (!appearedHome.includes(curPitcherHome.name)) { 
                        curPitcherHome.stats.appearances++; 
                        appearedHome.push(curPitcherHome.name); 
                    } 
                    pitchCountHome = 0; 
                    initMatchStat(curPitcherHome.name);
                } else {
                    // もし一軍リリーフが全員ヘロヘロなら、二軍の元気なロングリリーフを緊急昇格して使わせる
                    let minorReliefs = home.pitchers.filter(p => p.role === "二軍リリーフ" && p.staCurrent >= 25);
                    if (minorReliefs.length > 0) {
                        curPitcherHome = minorReliefs[0];
                        if (!appearedHome.includes(curPitcherHome.name)) {
                            curPitcherHome.stats.appearances++;
                            appearedHome.push(curPitcherHome.name);
                        }
                        pitchCountHome = 0;
                        initMatchStat(curPitcherHome.name);
                    }
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
                if (scoreDiff >= -1 && scoreDiff <= 2 && curPitcherAway.role === "先発") {
                    needChange = true;
                }
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
                    available.sort((a, b) => {
                        let scoreA = a.staCurrent * getConditionModifier(a.condition, "batBarrel");
                        let scoreB = b.staCurrent * getConditionModifier(b.condition, "batBarrel");
                        return scoreB - scoreA;
                    });
                    
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
                    
                    let isHR = Math.random() < (finalBarrel * BALBALANCING_CONFIG.batting.hrMultiplier);
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

    // スタミナ消費計算（イニングアウト数連動 ＋ 登板一律コスト）
    away.pitchers.forEach(p => { 
        if (appearedAway.includes(p.name)) {
            let matchOuts = pitcherMatchStats[p.name] ? pitcherMatchStats[p.name].outs : 0;
            let cost = p.role === "先発" ? 0 : (10 + matchOuts * 4); // コストを12➔10にして連投耐性を微調整
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
