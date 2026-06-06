// simulator.js
let userTeamId = 0; 

function selectUserTeam(val) {
    userTeamId = parseInt(val);
    let editSelect = document.getElementById("edit_team_select");
    if(editSelect) editSelect.value = userTeamId;
    onEditorTeamChange();
    updateUIAll();
}

function getConditionModifier(condition, type) {
    const modifiers = {
        "絶好調": { batBarrel: 1.25, batSo: 0.80, pitPitch: 1.15 },
        "好調":   { batBarrel: 1.10, batSo: 0.90, pitPitch: 1.05 },
        "普通":   { batBarrel: 1.00, batSo: 1.00, pitPitch: 1.00 },
        "不調":   { batBarrel: 0.85, batSo: 1.15, pitPitch: 0.90 },
        "絶不調": { batBarrel: 0.70, batSo: 1.30, pitPitch: 0.80 }
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
        let tiredRelief = t.pitchers.find(p => p.role === "リリーフ" && p.staCurrent <= 10);
        let freshMinorRelief = t.pitchers.find(p => p.role === "二軍リリーフ" && p.staCurrent >= 30);
        if (tiredRelief && freshMinorRelief) {
            tiredRelief.role = "二軍リリーフ"; freshMinorRelief.role = "リリーフ";
        }
        let slumpFirstTeam = t.batters.find(b => b.role === "一軍控え" && (b.condition === "絶不調" || b.condition === "不調"));
        let hotMinorTeam = t.batters.find(b => b.role === "二軍" && (b.condition === "絶好調" || b.condition === "好調"));
        if (slumpFirstTeam && hotMinorTeam) {
            slumpFirstTeam.role = "二軍"; hotMinorTeam.role = "一軍控え";
        }
    });
}

function processOffseasonEvolution() {
    teams.forEach(t => {
        t.batters.forEach(b => {
            b.age += 1; b.proYears += 1;
            let growthPotential = Math.min(10, Math.floor((b.exp || 0) / 15)); 
            b.exp = 0;
            if (b.age <= 24) {
                b.barrel = Math.min(40, b.barrel + Math.floor(Math.random() * 4) + 1 + growthPotential * 0.3);
                b.isop = Math.min(60, b.isop + Math.floor(Math.random() * 5) + 2);
                b.so = Math.max(10, b.so - Math.floor(Math.random() * 2));
            } else if (b.age <= 29) {
                if(Math.random() < 0.4) b.barrel = Math.min(40, b.barrel + 1);
            } else if (b.age <= 34) {
                b.barrel = Math.max(5, b.barrel - (Math.floor(Math.random() * 2)));
                b.isop = Math.max(5, b.isop - (Math.floor(Math.random() * 3)));
            } else {
                b.barrel = Math.max(3, b.barrel - (Math.floor(Math.random() * 4) + 1));
                b.so = Math.min(45, b.so + Math.floor(Math.random() * 3));
            }
        });

        t.pitchers.forEach(p => {
            p.age += 1; p.proYears += 1;
            let growthPotential = Math.min(10, Math.floor((p.exp || 0) / 15));
            p.exp = 0;
            if (p.age <= 24) {
                p.h9 = Math.min(99, p.h9 + Math.floor(Math.random() * 4) + 1 + growthPotential * 0.3);
                p.k9 = Math.min(99, p.k9 + Math.floor(Math.random() * 4) + 1);
            } else if (p.age <= 29) {
                if(Math.random() < 0.4) p.h9 = Math.min(99, p.h9 + 1);
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
    if(totalGamesPlayed >= MAX_GAMES) {
        processOffseasonEvolution();
        totalGamesPlayed = 0; 
        teams.forEach(t => {
            t.wins = 0; t.losses = 0; t.draws = 0;
            t.batters.forEach(b => b.stats = { games: 0, ab: 0, hits: 0, hr: 0, rbi: 0, bb: 0, so: 0 });
            t.pitchers.forEach(p => p.stats = { era: 0, appearances: 0, wins: 0, losses: 0, saves: 0, ipOuts: 0, so: 0, bb: 0, er: 0 });
        });
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

    teams.forEach(t => {
        t.pitchers.forEach(p => { 
            let recovery = p.role.includes("二軍") ? 15 : 8;
            if(p.staCurrent < p.staMax) p.staCurrent = Math.min(p.staMax, p.staCurrent + 8); 
        });
    });

    totalGamesPlayed++;
    return roundResults;
}

function executeMatchLogic(away, home) {
    let pAway = away.pitchers.filter(p => p.role === "先発")[away.rotationIdx % 5];
    let pHome = home.pitchers.filter(p => p.role === "先発")[home.rotationIdx % 5];
    
    pAway.staCurrent = pAway.staMax; pHome.staCurrent = pHome.staMax;
    
    let curPitcherAway = pAway; let curPitcherHome = pHome;
    curPitcherAway.stats.appearances++; curPitcherHome.stats.appearances++;
    
    pAway.exp = (pAway.exp || 0) + 15; pHome.exp = (pHome.exp || 0) + 15;

    let appearedAway = [pAway.name]; let appearedHome = [pHome.name];
    let awayScore = 0, homeScore = 0; let awayOrder = 0, homeOrder = 0;
    let pitchCountAway = 0, pitchCountHome = 0;
    let curPitcherAwayErInMatch = 0; let curPitcherHomeErInMatch = 0;
    let currentInningOutsAway = 0; let currentInningOutsHome = 0; 
    let potentialSaverAway = null; let potentialSaverHome = null;

    for (let inning = 1; inning <= 9; inning++) {
        currentInningOutsAway = 0; currentInningOutsHome = 0;

        // 表の攻撃
        let outs = 0; let bases = [false, false, false];
        while (outs < 3) {
            let needChange = false;
            if (inning === 9 && curPitcherHome.role !== "守護神") {
                let scoreDiff = homeScore - awayScore;
                if (scoreDiff >= 0 && scoreDiff <= 3) {
                    let closer = home.pitchers.find(p => p.role === "守護神" && p.staCurrent >= 10);
                    if (closer) {
                        curPitcherHome = closer; needChange = false;
                        if (!appearedHome.includes(curPitcherHome.name)) {
                            curPitcherHome.stats.appearances++; appearedHome.push(curPitcherHome.name);
                            potentialSaverHome = curPitcherHome;
                            curPitcherHome.exp = (curPitcherHome.exp || 0) + 10;
                        }
                        pitchCountHome = 0; curPitcherHomeErInMatch = 0; currentInningOutsHome = 0;
                    }
                }
            }

            if (curPitcherHome.role !== "守護神" && (inning === 7 || inning === 8)) {
                let scoreDiff = homeScore - awayScore;
                if (scoreDiff >= 0 && scoreDiff <= 2 && curPitcherHome.role === "先発") {
                    let setupMen = home.pitchers.filter(p => p.role === "リリーフ" && p.staCurrent > 20);
                    if (setupMen.length > 0) {
                        setupMen.sort((a,b) => a.stats.era - b.stats.era);
                        curPitcherHome = setupMen[0];
                        if (!appearedHome.includes(curPitcherHome.name)) {
                            curPitcherHome.stats.appearances++; appearedHome.push(curPitcherHome.name);
                            curPitcherHome.exp = (curPitcherHome.exp || 0) + 8;
                        }
                        pitchCountHome = 0; curPitcherHomeErInMatch = 0; currentInningOutsHome = 0;
                    }
                }
            }

            if (curPitcherHome.role !== "守護神") {
                if (inning <= 5) {
                    if (pitchCountHome >= curPitcherHome.staMax || curPitcherHomeErInMatch >= 6) needChange = true;
                } else {
                    if (curPitcherHome.role === "先発") {
                        if (pitchCountHome >= curPitcherHome.staMax || curPitcherHomeErInMatch >= 4) needChange = true;
                    } else {
                        if (currentInningOutsHome >= 3 || curPitcherHomeErInMatch >= 3 || pitchCountHome >= curPitcherHome.staMax) needChange = true;
                    }
                }
            } else {
                if (curPitcherHomeErInMatch >= 3) needChange = true;
            }

            if (needChange) {
                let availableReliefs = home.pitchers.filter(p => p.role === "リリーフ" && p.staCurrent > 15);
                if (availableReliefs.length > 0) {
                    availableReliefs.sort((a, b) => a.stats.appearances - b.stats.appearances);
                    curPitcherHome = availableReliefs[0];
                    if (!appearedHome.includes(curPitcherHome.name)) {
                        curPitcherHome.stats.appearances++; appearedHome.push(curPitcherHome.name);
                        curPitcherHome.exp = (curPitcherHome.exp || 0) + 8;
                    }
                    pitchCountHome = 0; curPitcherHomeErInMatch = 0; currentInningOutsHome = 0;
                }
            }
            
            let currentBatters = away.batters.filter(bat => bat.role !== "控え" && bat.role !== "二軍" && bat.role.includes("番"));
            let b = currentBatters[awayOrder];
            
            if(!b) {
                outs++; curPitcherHome.stats.ipOuts++; currentInningOutsHome++;
                awayOrder = (awayOrder + 1) % (currentBatters.length || 9);
                continue;
            }

            b.stats.ab++; pitchCountHome += 4;
            b.exp = (b.exp || 0) + 2; 
            
            let batConditionMod = getConditionModifier(b.condition, "batSo");
            let pitConditionMod = getConditionModifier(curPitcherHome.condition, "pit");

            let bbP = (b.bb/100) + ((100 - curPitcherHome.bb9)*0.0004);
            let soP = ((b.so/100) * batConditionMod) + ((curPitcherHome.k9*0.0007) * pitConditionMod);
            let rand = Math.random();
            
            if(rand < bbP) {
                b.stats.bb++; curPitcherHome.stats.bb++;
                let runs = advanceRunners(bases, "BB");
                awayScore += runs; curPitcherHome.stats.er += runs; curPitcherHomeErInMatch += runs; b.stats.rbi += runs;
            } else if(rand < bbP + soP) {
                outs++; b.stats.so++; curPitcherHome.stats.so++;
                curPitcherHome.stats.ipOuts++; currentInningOutsHome++; 
            } else {
                let hit_gb_el = document.getElementById('hit_gb');
                const gb_p = hit_gb_el ? parseFloat(hit_gb_el.value) : 45;
                const fb_p = parseFloat(document.getElementById('hit_fb').value) || 35;
                const ld_p = parseFloat(document.getElementById('hit_ld').value) || 20;
                let rand_type = Math.random() * (gb_p + fb_p + ld_p);
                let hitType = rand_type < gb_p ? "GB" : (rand_type < gb_p + fb_p ? "FB" : "LD");
                
                let baseHitChance = hitType === "GB" ? 0.32 : (hitType === "FB" ? 0.28 : 0.76);
                let h9Effect = ((55 - curPitcherHome.h9) * 0.0012) / pitConditionMod;
                let finalHitChance = Math.max(0.18, Math.min(0.92, baseHitChance + h9Effect));

                if(Math.random() < finalHitChance) {
                    let hr9Reduction = ((curPitcherHome.hr9 / 100) * 0.4) * pitConditionMod;
                    let finalBarrel = ((b.barrel / 100) * getConditionModifier(b.condition, "batBarrel")) * (1 - hr9Reduction);
                    
                    let kind = "1B";
                    if ((hitType === "FB" || hitType === "LD") && Math.random() < finalBarrel) {
                        kind = "HR"; b.stats.hr++; b.exp = (b.exp || 0) + 5;
                    } else {
                        let extraBaseChance = 0.15 + (b.isop * 0.0035);
                        kind = Math.random() < extraBaseChance ? "2B" : "1B";
                    }
                    b.stats.hits++;
                    let runs = advanceRunners(bases, kind);
                    awayScore += runs; curPitcherHome.stats.er += runs; curPitcherHomeErInMatch += runs; b.stats.rbi += runs;
                } else { 
                    outs++; curPitcherHome.stats.ipOuts++; currentInningOutsHome++; 
                }
            }
            awayOrder = (awayOrder + 1) % (currentBatters.length || 9);
        }

        // 裏の攻撃
        outs = 0; bases = [false, false, false];
        while (outs < 3) {
            let needChange = false;
            if (inning === 9 && curPitcherAway.role !== "守護神") {
                let scoreDiff = awayScore - homeScore;
                if (scoreDiff >= 0 && scoreDiff <= 3) {
                    let closer = away.pitchers.find(p => p.role === "守護神" && p.staCurrent >= 10);
                    if (closer) {
                        curPitcherAway = closer; needChange = false;
                        if (!appearedAway.includes(curPitcherAway.name)) {
                            curPitcherAway.stats.appearances++; appearedAway.push(curPitcherAway.name);
                            potentialSaverAway = curPitcherAway;
                            curPitcherAway.exp = (curPitcherAway.exp || 0) + 10;
                        }
                        pitchCountAway = 0; curPitcherAwayErInMatch = 0; currentInningOutsAway = 0;
                    }
                }
            }

            if (curPitcherAway.role !== "守護神" && (inning === 7 || inning === 8)) {
                let scoreDiff = awayScore - homeScore;
                if (scoreDiff >= 0 && scoreDiff <= 2 && curPitcherAway.role === "先発") {
                    let setupMen = away.pitchers.filter(p => p.role === "リリーフ" && p.staCurrent > 20);
                    if (setupMen.length > 0) {
                        setupMen.sort((a,b) => a.stats.era - b.stats.era);
                        curPitcherAway = setupMen[0];
                        if (!appearedAway.includes(curPitcherAway.name)) {
                            curPitcherAway.stats.appearances++; appearedAway.push(curPitcherAway.name);
                            curPitcherAway.exp = (curPitcherAway.exp || 0) + 8;
                        }
                        pitchCountAway = 0; curPitcherAwayErInMatch = 0; currentInningOutsAway = 0;
                    }
                }
            }

            if (curPitcherAway.role !== "守護神") {
                if (inning <= 5) {
                    if (pitchCountAway >= curPitcherAway.staMax || curPitcherAwayErInMatch >= 6) needChange = true;
                } else {
                    if (curPitcherAway.role === "先発") {
                        if (pitchCountAway >= curPitcherAway.staMax || curPitcherAwayErInMatch >= 4) needChange = true;
                    } else {
                        if (currentInningOutsAway >= 3 || curPitcherAwayErInMatch >= 3 || pitchCountAway >= curPitcherAway.staMax) needChange = true;
                    }
                }
            } else {
                if (curPitcherAwayErInMatch >= 3) needChange = true;
            }

            if (needChange) {
                let availableReliefs = away.pitchers.filter(p => p.role === "リリーフ" && p.staCurrent > 15);
                if (availableReliefs.length > 0) {
                    availableReliefs.sort((a, b) => a.stats.appearances - b.stats.appearances);
                    curPitcherAway = availableReliefs[0];
                    if (!appearedAway.includes(curPitcherAway.name)) {
                        curPitcherAway.stats.appearances++; appearedAway.push(curPitcherAway.name);
                        curPitcherAway.exp = (curPitcherAway.exp || 0) + 8;
                    }
                    pitchCountAway = 0; curPitcherAwayErInMatch = 0; currentInningOutsAway = 0;
                }
            }
            
            let currentBattersHome = home.batters.filter(bat => bat.role !== "控え" && bat.role !== "二軍" && bat.role.includes("番"));
            let b = currentBattersHome[homeOrder];
            
            if(!b) {
                outs++; curPitcherAway.stats.ipOuts++; currentInningOutsAway++;
                homeOrder = (homeOrder + 1) % (currentBattersHome.length || 9);
                continue;
            }

            b.stats.ab++; pitchCountAway += 4; b.exp = (b.exp || 0) + 2;
            
            let batConditionMod = getConditionModifier(b.condition, "batSo");
            let pitConditionMod = getConditionModifier(curPitcherAway.condition, "pit");

            let bbP = (b.bb/100) + ((100 - curPitcherAway.bb9)*0.0006);
            let soP = ((b.so/100) * batConditionMod) + ((curPitcherAway.k9*0.001) * pitConditionMod);
            let rand = Math.random();
            
            if(rand < bbP) {
                b.stats.bb++; curPitcherAway.stats.bb++;
                let runs = advanceRunners(bases, "BB");
                homeScore += runs; curPitcherAway.stats.er += runs; curPitcherAwayErInMatch += runs; b.stats.rbi += runs;
            } else if(rand < bbP + soP) {
                outs++; b.stats.so++; curPitcherAway.stats.so++;
                curPitcherAway.stats.ipOuts++; currentInningOutsAway++; 
            } else {
                let hit_gb_el = document.getElementById('hit_gb');
                const gb_p = hit_gb_el ? parseFloat(hit_gb_el.value) : 45;
                const fb_p = parseFloat(document.getElementById('hit_fb').value) || 35;
                const ld_p = parseFloat(document.getElementById('hit_ld').value) || 20;
                let rand_type = Math.random() * (gb_p + fb_p + ld_p);
                let hitType = rand_type < gb_p ? "GB" : (rand_type < gb_p + fb_p ? "FB" : "LD");
                
                let baseHitChance = hitType === "GB" ? 0.32 : (hitType === "FB" ? 0.28 : 0.76);
                let h9Effect = ((55 - curPitcherAway.h9) * 0.0015) / pitConditionMod;
                let finalHitChance = Math.max(0.18, Math.min(0.92, baseHitChance + h9Effect));

                if(Math.random() < finalHitChance) {
                    let hr9Reduction = ((curPitcherAway.hr9 / 100) * 0.4) * pitConditionMod;
                    let finalBarrel = ((b.barrel / 100) * getConditionModifier(b.condition, "batBarrel")) * (1 - hr9Reduction);
                    
                    let kind = "1B";
                    if ((hitType === "FB" || hitType === "LD") && Math.random() < finalBarrel) {
                        kind = "HR"; b.stats.hr++; b.exp = (b.exp || 0) + 5;
                    } else {
                        let extraBaseChance = 0.15 + (b.isop * 0.0035);
                        kind = Math.random() < extraBaseChance ? "2B" : "1B";
                    }
                    b.stats.hits++;
                    let runs = advanceRunners(bases, kind);
                    homeScore += runs; curPitcherAway.stats.er += runs; curPitcherAwayErInMatch += runs; b.stats.rbi += runs;
                } else { 
                    outs++; curPitcherAway.stats.ipOuts++; currentInningOutsAway++; 
                }
            }
            homeOrder = (homeOrder + 1) % (currentBattersHome.length || 9);
        }
    }

    if(awayScore > homeScore) { 
        away.wins++; home.losses++; pAway.stats.wins++; pHome.stats.losses++; 
        if(potentialSaverAway && awayScore - homeScore <= 3) potentialSaverAway.stats.saves++;
    } else if(homeScore > awayScore) { 
        home.wins++; away.losses++; pHome.stats.wins++; pAway.stats.losses++; 
        if(potentialSaverHome && homeScore - awayScore <= 3) potentialSaverHome.stats.saves++;
    } else { 
        away.draws++; home.draws++; 
    }

    away.pitchers.forEach(p => { 
        if (p.name === pAway.name) p.staCurrent = 0; 
        else if (appearedAway.includes(p.name)) p.staCurrent = Math.max(0, p.staCurrent - 12);
    });
    home.pitchers.forEach(p => { 
        if (p.name === pHome.name) p.staCurrent = 0; 
        else if (appearedHome.includes(p.name)) p.staCurrent = Math.max(0, p.staCurrent - 12);
    });

    teams.forEach(t => {
        t.pitchers.forEach(p => { if(p.stats.ipOuts > 0) p.stats.era = (p.stats.er * 9) / (p.stats.ipOuts / 3); });
    });

    away.rotationIdx++; home.rotationIdx++;
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
    } else if (hitKind === "2B") {
        if (bases[2]) { runs++; bases[2] = false; }
        if (bases[1]) { runs++; bases[1] = false; }
        if (bases[0]) { bases[2] = true; bases[0] = false; }
        bases[1] = true;
    } else if (hitKind === "HR") {
        runs += 1 + (bases[0]?1:0) + (bases[1]?1:0) + (bases[2]?1:0);
        bases.fill(false);
    }
    return runs;
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
    let rEl = document.getElementById("quick_match_results");
    if(rEl) rEl.innerHTML = "<tr><td style='color:orange; font-weight:bold;'>143試合全日程終了！翌年シーズンへ移行しました！</td></tr>";
    updateUIAll();
}

function resetSeason() {
    totalGamesPlayed = 0; initializeLeagueData();
    let rEl = document.getElementById("quick_match_results");
    if(rEl) rEl.innerHTML = "<tr><td>シーズンをリセットしました。</td></tr>";
    onEditorTeamChange(); updateUIAll();
}

function onEditorTeamChange() {
    let teamSelect = document.getElementById("edit_team_select");
    let teamIdx = teamSelect ? parseInt(teamSelect.value) : 0;
    if (isNaN(teamIdx)) teamIdx = 0;
    
    let team = teams[teamIdx];
    let playerSelect = document.getElementById("edit_player_select");
    if(!playerSelect || !team) return;
    playerSelect.innerHTML = "";

    team.batters.forEach((p, idx) => { playerSelect.innerHTML += `<option value="bat_${idx}">[野手] ${p.role} - ${p.name} (${p.age}歳/年:${p.proYears}/${p.condition})</option>`; });
    team.pitchers.forEach((p, idx) => { playerSelect.innerHTML += `<option value="pit_${idx}">[投手] ${p.role} - ${p.name} (${p.age}歳/年:${p.proYears}/${p.condition})</option>`; });
    playerSelect.selectedIndex = 0; onEditorPlayerChange();
}

function onEditorPlayerChange() {
    let teamSelect = document.getElementById("edit_team_select");
    let teamIdx = teamSelect ? parseInt(teamSelect.value) : 0;
    if (isNaN(teamIdx)) teamIdx = 0;

    let playerSelect = document.getElementById("edit_player_select");
    if(!playerSelect || !playerSelect.value) return;
    let playerVal = playerSelect.value;
    
    let type = playerVal.split("_")[0]; let idx = parseInt(playerVal.split("_")[1]);
    let player = type === "bat" ? teams[teamIdx].batters[idx] : teams[teamIdx].pitchers[idx];

    let nameForm = document.getElementById("form_name");
    if(!nameForm) return;

    nameForm.value = player.name;
    document.getElementById("form_role").value = player.role;
    document.getElementById("form_pos").value = player.currentPos;

    if(type === "bat") {
        document.getElementById("form_bat_stats").style.display = "block";
        document.getElementById("form_pit_stats").style.display = "none";
        document.getElementById("form_bb").value = player.bb;
        document.getElementById("form_so").value = player.so;
        document.getElementById("form_barrel").value = player.barrel;
        document.getElementById("form_isop").value = player.isop;
        document.getElementById("form_uzr").value = player.uzr;
        document.getElementById("form_err").value = player.err;
    } else {
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
    if (isNaN(teamIdx)) teamIdx = 0;

    let playerVal = document.getElementById("edit_player_select").value;
    let type = playerVal.split("_")[0]; let idx = parseInt(playerVal.split("_")[1]);
    let team = teams[teamIdx];
    
    if(type === "bat") {
        let p = team.batters[idx];
        p.name = document.getElementById("form_name").value; p.role = document.getElementById("form_role").value;
        p.currentPos = document.getElementById("form_pos").value; p.bb = parseFloat(document.getElementById("form_bb").value);
        p.so = parseFloat(document.getElementById("form_so").value); p.barrel = parseFloat(document.getElementById("form_barrel").value);
        p.isop = parseFloat(document.getElementById("form_isop").value); p.uzr = parseFloat(document.getElementById("form_uzr").value);
        p.err = parseFloat(document.getElementById("form_err").value);
    } else {
        let p = team.pitchers[idx];
        p.name = document.getElementById("form_name").value; p.role = document.getElementById("form_role").value;
        p.currentPos = document.getElementById("form_pos").value; p.h9 = parseFloat(document.getElementById("form_h9").value);
        p.k9 = parseFloat(document.getElementById("form_k9").value); p.bb9 = parseFloat(document.getElementById("form_bb9").value);
        p.hr9 = parseFloat(document.getElementById("form_hr9").value); p.staMax = parseFloat(document.getElementById("form_sta").value);
    }
    
    let currentPositions = team.batters.map(b => b.currentPos);
    let uniqLen = [...new Set(currentPositions)].length;
    let warningEl = document.getElementById("editor_dup_warning");
    if(warningEl) warningEl.style.display = (uniqLen < 8) ? "block" : "none";

    let savedIndex = document.getElementById("edit_player_select").selectedIndex;
    onEditorTeamChange(); document.getElementById("edit_player_select").selectedIndex = savedIndex;
    updateUIAll();
}

function updateUIAll() {
    let gameCountEl = document.getElementById("current_game_count");
    if(!gameCountEl) return;
    
    gameCountEl.innerText = totalGamesPlayed;
    document.getElementById("current_week_count").innerText = Math.floor(totalGamesPlayed / 6) + 1;
    
    let sorted = [...teams].sort((a,b) => (b.wins / ((b.wins + b.losses) || 1)) - (a.wins / ((a.wins + a.losses) || 1)));
    let sBody = document.getElementById("standings_body"); sBody.innerHTML = "";
    sorted.forEach((t, i) => {
        let wp = t.wins / ((t.wins + t.losses) || 1);
        let isMyTeam = (t.id === userTeamId);
        let teamDisplay = isMyTeam ? `<span style="color:#e53e3e;">★</span>${t.name}` : t.name;
        let rowStyle = isMyTeam ? `style="background-color: #e6fffa; font-weight:bold;"` : "";
        sBody.innerHTML += `<tr ${rowStyle}><td>${i+1}</td><td><b>${teamDisplay}</b></td><td>${t.wins}</td><td>${t.losses}</td><td>${t.draws}</td><td>${wp.toFixed(3)}</td><td>-</td></tr>`;
    });

    let bList = []; teams.forEach(t => t.batters.forEach(b => bList.push({tName: t.name, data: b})));
    bList.sort((a,b) => (b.data.stats.hits / (b.data.stats.ab || 1)) - (a.data.stats.hits / (a.data.stats.ab || 1)));
    let batBody = document.querySelector("#batting_stats_table tbody"); batBody.innerHTML = "";
    bList.slice(0, 15).forEach(item => {
        let b = item.data; let avg = b.stats.hits / (b.stats.ab || 1);
        batBody.innerHTML += `<tr><td>${item.tName}</td><td><b>${b.name} (${b.age}歳/${b.graduation})</b></td><td>${b.currentPos}</td><td>${avg.toFixed(3)}</td><td>${b.stats.games}</td><td>${b.stats.ab}</td><td>${b.stats.hits}</td><td>${b.stats.hr}</td><td>${b.stats.rbi}</td><td>${b.stats.bb}</td></tr>`;
    });

    let pList = []; teams.forEach(t => t.pitchers.forEach(p => pList.push({tName: t.name, data: p})));
    pList.sort((a,b) => {
        if(a.data.stats.ipOuts === 0) return 1; if(b.data.stats.ipOuts === 0) return -1;
        return a.data.stats.era - b.data.stats.era;
    });
    let pitBody = document.querySelector("#pitching_stats_table tbody"); pitBody.innerHTML = "";
    pList.forEach(item => {
        let p = item.data;
        pitBody.innerHTML += `<tr><td>${item.tName}</td><td><b>${p.name} (${p.age}歳/年:${p.proYears})</b></td><td>${p.role}</td><td><b>${p.stats.ipOuts > 0 ? p.stats.era.toFixed(2) : '-.--'}</b></td><td>${p.stats.appearances}</td><td>${p.stats.wins}</td><td>${p.stats.losses}</td><td><b>${p.stats.saves}</b></td><td>${formatInningsPitched(p.stats.ipOuts)}</td><td>${p.stats.so}</td><td>${p.staCurrent}</td></tr>`;
    });
}

function switchTab(tabId, el) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active'); el.classList.add('active');
}

// ドキュメント最下部での確実な初期化エントリー
initializeLeagueData();
onEditorTeamChange();
updateUIAll();
