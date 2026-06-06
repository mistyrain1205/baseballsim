// simulator.js

function getDynamicSchedule(roundCount) {
    let numTeams = 6; let totalRounds = numTeams - 1; let currentRound = roundCount % totalRounds;
    let pairings = []; let list = [0, 1, 2, 3, 4, 5];
    for (let i = 0; i < numTeams / 2; i++) {
        let awayIdx = (currentRound + i) % (numTeams - 1);
        let homeIdx = (numTeams - 1 - i + currentRound) % (numTeams - 1);
        if (i === 0) homeIdx = numTeams - 1; 
        pairings.push([list[awayIdx], list[homeIdx]]);
    }
    return pairings;
}

let userTeamId = 0; 
let currentYear = 1; 

function selectUserTeam(val) {
    userTeamId = parseInt(val);
    let editSelect = document.getElementById("edit_team_select");
    if(editSelect) editSelect.value = userTeamId;
    onEditorTeamChange(); updateUIAll();
}

function getConditionModifier(condition, type) {
    const modifiers = {
        "絶好調": { batBarrel: 1.35, batSo: 0.75, pitPitch: 1.10 }, 
        "好調":   { batBarrel: 1.15, batSo: 0.85, pitPitch: 1.03 },
        "普通":   { batBarrel: 1.00, batSo: 1.00, pitPitch: 1.00 },
        "不調":   { batBarrel: 0.80, batSo: 1.20, pitPitch: 0.95 },
        "絶不調": { batBarrel: 0.65, batSo: 1.35, pitPitch: 0.85 }
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
            tiredRelief.role = "二軍リリーフ"; freshMinorRelief.role = "リリーフ";
        }
        let slumpFirstTeam = t.batters.find(b => b.role === 0 && (b.condition === "絶不調" || b.condition === "不調"));
        let hotMinorTeam = t.batters.find(b => b.role === -1 && (b.condition === "絶好調" || b.condition === "好調"));
        if (slumpFirstTeam && hotMinorTeam) {
            slumpFirstTeam.role = -1; hotMinorTeam.role = 0;
        }
    });
}

function executeOffseasonRosterEvents() {
    let logMsg = "";
    let targetCutCount = Math.floor(Math.random() * 8) + 8; 
    let cutBattersMax = Math.floor(targetCutCount / 2) + (targetCutCount % 2); 
    let cutPitchersMax = Math.floor(targetCutCount / 2); 

    teams.forEach(t => {
        t.batters.sort((a,b) => (a.barrel + (a.age * 0.2)) - (b.barrel + (b.age * 0.2))); 
        let releasedBatters = 0;
        t.batters = t.batters.filter(b => {
            if (b.role <= 0 && releasedBatters < cutBattersMax) {
                releasedBatters++;
                if(t.id === userTeamId) logMsg += `【戦力外】${b.name} 野手(${b.age}歳)を自由契約に。\n`;
                return false; 
            }
            return true;
        });

        t.pitchers.sort((a,b) => (a.h9 + (a.age * 0.3)) - (b.h9 + (b.age * 0.3)));
        let releasedPitchers = 0;
        t.pitchers = t.pitchers.filter(p => {
            if (p.role !== "先発" && p.role !== "守護神" && releasedPitchers < cutPitchersMax) {
                releasedPitchers++;
                if(t.id === userTeamId) logMsg += `【戦力外】${p.name} 投手(${p.age}歳)を自由契約に。\n`;
                return false;
            }
            return true;
        });

        let draftRound = 1;
        while(t.batters.length < 40) {
            let newBat = createBlankBatter(false, 0);
            newBat.role = -1; t.batters.push(newBat);
            if(t.id === userTeamId) { logMsg += `【ドラフト${draftRound}位】${newBat.name} 野手獲得！\n`; draftRound++; }
        }
        while(t.pitchers.length < 30) {
            let newPit = createBlankPitcher("二軍リリーフ"); t.pitchers.push(newPit);
            if(t.id === userTeamId) { logMsg += `【ドラフト${draftRound}位】${newPit.name} 投手獲得！\n`; draftRound++; }
        }
    });
    alert(`ーーー 👔 オフシーズン更新速報 (第 ${currentYear} 年目オフ) ーーー\n\n入れ替え人数: ${targetCutCount}名\n\n${logMsg}`);
}

function processOffseasonEvolution() {
    teams.forEach(t => {
        t.batters.forEach(b => {
            b.age += 1; b.proYears += 1;
            let growthPotential = Math.min(10, Math.floor((b.exp || 0) / 15)); b.exp = 0;
            if (b.age <= 24) {
                b.barrel = Math.min(45, b.barrel + Math.floor(Math.random() * 5) + 1 + growthPotential * 0.3); 
                b.isop = Math.min(65, b.isop + Math.floor(Math.random() * 6) + 2);
                b.so = Math.max(10, b.so - Math.floor(Math.random() * 2));
            } else if (b.age <= 29) {
                if(Math.random() < 0.4) b.barrel = Math.min(45, b.barrel + 1);
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
    if(totalGamesPlayed >= MAX_GAMES) {
        processOffseasonEvolution(); executeOffseasonRosterEvents(); 
        totalGamesPlayed = 0; currentYear += 1; 
        teams.forEach(t => {
            t.wins = 0; t.losses = 0; t.draws = 0;
            t.batters.forEach(b => b.stats = { games: 0, ab: 0, hits: 0, hr: 0, rbi: 0, bb: 0, so: 0 });
            t.pitchers.forEach(p => { p.staCurrent = p.staMax; p.stats = { era: 0, appearances: 0, wins: 0, losses: 0, saves: 0, ipOuts: 0, so: 0, bb: 0, er: 0 }; });
        });
        updateUIAll(); return null;
    }
    changeAllPlayersCondition(); executeFrontOfficeAI();
    let pattern = getDynamicSchedule(totalGamesPlayed);
    let roundResults = [];
    pattern.forEach(pair => {
        let teamAway = teams[pair[0]]; let teamHome = teams[pair[1]];
        let res = executeMatchLogic(teamAway, teamHome);
        roundResults.push(res);
    });
    teams.forEach(t => { t.pitchers.forEach(p => { let recovery = p.role.includes("二軍") ? 14 : 4; if(p.staCurrent < p.staMax) p.staCurrent = Math.min(p.staMax, p.staCurrent + recovery); }); });
    totalGamesPlayed++; return roundResults;
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

    for (let inning = 1; inning <= 9; inning++) {
        currentInningOutsAway = 0; currentInningOutsHome = 0;

        // 表の攻撃
        let outs = 0; let bases = [false, false, false];
        while (outs < 3) {
            let needChange = false;
            if (inning === 9 && curPitcherHome.role !== "守護神") {
                let scoreDiff = homeScore - awayScore;
                if (scoreDiff >= 0 && scoreDiff <= 3) {
                    let closer = home.pitchers.find(p => p.role === "守護神" && p.staCurrent >= 8);
                    if (closer) { curPitcherHome = closer; if (!appearedHome.includes(closer.name)) { closer.stats.appearances++; appearedHome.push(closer.name); closer.exp = (closer.exp||0)+10;} pitchCountHome = 0; curPitcherHomeErInMatch = 0; currentInningOutsHome = 0; }
                }
            }
            if (curPitcherHome.role !== "守護神" && (inning === 7 || inning === 8)) {
                let scoreDiff = homeScore - awayScore;
                if (scoreDiff >= 0 && scoreDiff <= 2 && curPitcherHome.role === "先発") {
                    let setup = home.pitchers.find(p => p.role === "リリーフ" && p.staCurrent > 15);
                    if (setup) { curPitcherHome = setup; if (!appearedHome.includes(setup.name)) { setup.stats.appearances++; appearedHome.push(setup.name); setup.exp = (setup.exp||0)+8;} pitchCountHome = 0; curPitcherHomeErInMatch = 0; currentInningOutsHome = 0; }
                }
            }
            if (curPitcherHome.role !== "守護神") {
                if (pitchCountHome >= curPitcherHome.staMax || curPitcherHomeErInMatch >= 3) needChange = true;
            } else { if (curPitcherHomeErInMatch >= 2) needChange = true; }

            if (needChange) {
                let available = home.pitchers.filter(p => p.role === "リリーフ" && p.staCurrent > 10);
                if (available.length > 0) { curPitcherHome = available[0]; if (!appearedHome.includes(curPitcherHome.name)) { curPitcherHome.stats.appearances++; appearedHome.push(curPitcherHome.name); } pitchCountHome = 0; curPitcherHomeErInMatch = 0; currentInningOutsHome = 0; }
            }
            
            // 【完全解決】数値が1~9のスタメンだけを正確にフィルタリング
            let currentBatters = away.batters.filter(bat => bat.role >= 1 && bat.role <= 9);
            currentBatters.sort((a, b) => a.role - b.role);
            let b = currentBatters[awayOrder];
            
            if(!b) { outs++; awayOrder = (awayOrder + 1) % 9; continue; }

            b.stats.ab++; pitchCountHome += 4; b.stats.games = 1;
            let bbP = 0.08; let soP = 0.18; let rand = Math.random(); // 確率スケールを完全に固定化
            
            if(rand < bbP) {
                b.stats.bb++; curPitcherHome.stats.bb++; awayScore += advanceRunners(bases, "BB");
            } else if(rand < bbP + soP) {
                outs++; b.stats.so++; curPitcherHome.stats.so++;
            } else {
                b.stats.hits++; b.exp = (b.exp || 0) + 2;
                let isHR = Math.random() < (b.barrel / 100);
                awayScore += advanceRunners(bases, isHR ? "HR" : "1B");
                if(isHR) b.stats.hr++;
            }
            awayOrder = (awayOrder + 1) % 9;
        }

        // 裏の攻撃
        outs = 0; bases = [false, false, false];
        while (outs < 3) {
            let needChange = false;
            if (inning === 9 && curPitcherAway.role !== "守護神") {
                let scoreDiff = awayScore - homeScore;
                if (scoreDiff >= 0 && scoreDiff <= 3) {
                    let closer = away.pitchers.find(p => p.role === "守護神" && p.staCurrent >= 8);
                    if (closer) { curPitcherAway = closer; if (!appearedAway.includes(closer.name)) { closer.stats.appearances++; appearedAway.push(closer.name); closer.exp = (closer.exp||0)+10;} pitchCountAway = 0; curPitcherAwayErInMatch = 0; currentInningOutsAway = 0; }
                }
            }
            if (curPitcherAway.role !== "守護神" && (inning === 7 || inning === 8)) {
                let scoreDiff = awayScore - homeScore;
                if (scoreDiff >= 0 && scoreDiff <= 2 && curPitcherAway.role === "先発") {
                    let setup = away.pitchers.find(p => p.role === "リリーフ" && p.staCurrent > 15);
                    if (setup) { curPitcherAway = setup; if (!appearedAway.includes(setup.name)) { setup.stats.appearances++; appearedAway.push(setup.name); setup.exp = (setup.exp||0)+8;} pitchCountAway = 0; curPitcherAwayErInMatch = 0; currentInningOutsAway = 0; }
                }
            }
            if (curPitcherAway.role !== "守護神") {
                if (pitchCountAway >= curPitcherAway.staMax || curPitcherAwayErInMatch >= 3) needChange = true;
            } else { if (curPitcherAwayErInMatch >= 2) needChange = true; }

            if (needChange) {
                let available = away.pitchers.filter(p => p.role === "リリーフ" && p.staCurrent > 10);
                if (available.length > 0) { curPitcherAway = available[0]; if (!appearedAway.includes(curPitcherAway.name)) { curPitcherAway.stats.appearances++; appearedAway.push(curPitcherAway.name); } pitchCountAway = 0; curPitcherAwayErInMatch = 0; currentInningOutsAway = 0; }
            }
            
            let currentBattersHome = home.batters.filter(bat => bat.role >= 1 && bat.role <= 9);
            currentBattersHome.sort((a, b) => a.role - b.role);
            let b = currentBattersHome[homeOrder];
            
            if(!b) { outs++; homeOrder = (homeOrder + 1) % 9; continue; }

            b.stats.ab++; pitchCountAway += 4; b.stats.games = 1;
            let bbP = 0.08; let soP = 0.18; let rand = Math.random();
            
            if(rand < bbP) {
                b.stats.bb++; curPitcherAway.stats.bb++; homeScore += advanceRunners(bases, "BB");
            } else if(rand < bbP + soP) {
                outs++; b.stats.so++; curPitcherAway.stats.so++;
            } else {
                b.stats.hits++; b.exp = (b.exp || 0) + 2;
                let isHR = Math.random() < (b.barrel / 100);
                homeScore += advanceRunners(bases, isHR ? "HR" : "1B");
                if(isHR) b.stats.hr++;
            }
            homeOrder = (homeOrder + 1) % 9;
        }
    }

    if(awayScore > homeScore) { away.wins++; home.losses++; } 
    else if(homeScore > awayScore) { home.wins++; away.losses++; } 
    else { away.draws++; home.draws++; }

    away.pitchers.forEach(p => { if (appearedAway.includes(p.name)) p.staCurrent = Math.max(0, p.staCurrent - 10); });
    home.pitchers.forEach(p => { if (appearedHome.includes(p.name)) p.staCurrent = Math.max(0, p.staCurrent - 10); });
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
    let playerVal = document.getElementById("edit_player_select").value;
    let type = playerVal.split("_")[0]; let idx = parseInt(playerVal.split("_")[1]);
    let team = teams[teamIdx];
    
    if(type === "bat") {
        let p = team.batters[idx];
        p.name = document.getElementById("form_name").value; p.role = parseInt(document.getElementById("form_role").value);
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
    onEditorTeamChange(); updateUIAll();
}

function updateUIAll() {
    let gameCountEl = document.getElementById("current_game_count");
    if(!gameCountEl) return;
    gameCountEl.innerText = totalGamesPlayed;
    
    let h2Title = document.querySelector(".card h2");
    if(h2Title && !h2Title.innerText.includes("就任")) {
        h2Title.innerHTML = `リーグ消化状況 (ペナント第 <span style='color:#e53e3e; font-weight:bold;'>${currentYear}</span> 年目): <span id="current_game_count">${totalGamesPlayed}</span> / 143 試合`;
    }

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

initializeLeagueData();
onEditorTeamChange();
updateUIAll();
