// simulator.js
let userTeamId = 0; // デフォルトは大阪(0)

// ユーザーがチームを切り替えた時の処理
function selectUserTeam(val) {
    userTeamId = parseInt(val);
    
    // エディタの球団選択も自動で連動させる（親切設計）
    document.getElementById("edit_team_select").value = userTeamId;
    onEditorTeamChange();
    
    // 順位表の表示を更新して★の位置を変える
    updateUIAll();
}

// 【差し替え】updateUIAll 内の「順位表描画」の部分を以下に修正
function updateUIAll() {
    document.getElementById("current_game_count").innerText = totalGamesPlayed;
    document.getElementById("current_week_count").innerText = Math.floor(totalGamesPlayed / 6) + 1;
    
    let sorted = [...teams].sort((a,b) => (b.wins / ((b.wins + b.losses) || 1)) - (a.wins / ((a.wins + a.losses) || 1)));
    let sBody = document.getElementById("standings_body"); 
    sBody.innerHTML = "";
    
    sorted.forEach((t, i) => {
        let wp = t.wins / ((t.wins + t.losses) || 1);
        
        // 【重要】ユーザーの選択したチームなら名前の前に★をつけ、背景を少し目立たせる
        let isMyTeam = (t.id === userTeamId);
        let teamDisplay = isMyTeam ? `<span style="color:#e53e3e;">★</span>${t.name}` : t.name;
        let rowStyle = isMyTeam ? `style="background-color: #e6fffa; font-weight:bold;"` : "";
        
        sBody.innerHTML += `<tr ${rowStyle}><td>${i+1}</td><td><b>${teamDisplay}</b></td><td>${t.wins}</td><td>${t.losses}</td><td>${t.draws}</td><td>${wp.toFixed(3)}</td><td>-</td></tr>`;
    });

    // --- 以下、個人成績（batters/pitchers）の描画コード（既存のまま）に続く ---
    let bList = []; teams.forEach(t => t.batters.forEach(b => bList.push({tName: t.name, data: b})));
    bList.sort((a,b) => (b.data.stats.hits / (b.data.stats.ab || 1)) - (a.data.stats.hits / (a.data.stats.ab || 1)));
    let batBody = document.querySelector("#batting_stats_table tbody"); batBody.innerHTML = "";
    bList.slice(0, 15).forEach(item => {
        let b = item.data; let avg = b.stats.hits / (b.stats.ab || 1);
        batBody.innerHTML += `<tr><td>${item.tName}</td><td><b>${b.name}</b></td><td>${b.currentPos}</td><td>${avg.toFixed(3)}</td><td>${b.stats.games}</td><td>${b.stats.ab}</td><td>${b.stats.hits}</td><td>${b.stats.hr}</td><td>${b.stats.rbi}</td><td>${b.stats.bb}</td></tr>`;
    });

    let pList = []; teams.forEach(t => t.pitchers.forEach(p => pList.push({tName: t.name, data: p})));
    pList.sort((a,b) => {
        if(a.data.stats.ipOuts === 0) return 1; if(b.data.stats.ipOuts === 0) return -1;
        return a.data.stats.era - b.data.stats.era;
    });
    let pitBody = document.querySelector("#pitching_stats_table tbody"); pitBody.innerHTML = "";
    pList.forEach(item => {
        let p = item.data;
        pitBody.innerHTML += `<tr><td>${item.tName}</td><td><b>${p.name}</b></td><td>${p.role}</td><td><b>${p.stats.ipOuts > 0 ? p.stats.era.toFixed(2) : '-.--'}</b></td><td>${p.stats.appearances}</td><td>${p.stats.wins}</td><td>${p.stats.losses}</td><td><b>${p.stats.saves}</b></td><td>${formatInningsPitched(p.stats.ipOuts)}</td><td>${p.stats.so}</td><td>${p.staCurrent}</td></tr>`;
    });
}


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

function simulateRound() {
    if(totalGamesPlayed >= MAX_GAMES) return null;
    let pattern = getDynamicSchedule(totalGamesPlayed);
    let roundResults = [];
    pattern.forEach(pair => {
        let teamAway = teams[pair[0]]; let teamHome = teams[pair[1]];
        let res = executeMatchLogic(teamAway, teamHome);
        roundResults.push(res);
    });
    teams.forEach(t => {
        t.pitchers.forEach(p => { if(p.staCurrent < p.staMax) p.staCurrent = Math.min(p.staMax, p.staCurrent + 8); });
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
                    }
                    pitchCountHome = 0; curPitcherHomeErInMatch = 0; currentInningOutsHome = 0;
                }
            }
            
            let currentBatters = away.batters.filter(bat => bat.role !== "控え" && bat.role.includes("番"));
            let b = currentBatters[awayOrder];
            
            if(!b) {
                outs++; curPitcherHome.stats.ipOuts++; currentInningOutsHome++;
                awayOrder = (awayOrder + 1) % (currentBatters.length || 9);
                continue;
            }

            b.stats.ab++; pitchCountHome += 4;
            let bbP = (b.bb/100) + ((100 - curPitcherHome.bb9)*0.0004);
            let soP = (b.so/100) + (curPitcherHome.k9*0.0007);
            let rand = Math.random();
            
            if(rand < bbP) {
                b.stats.bb++; curPitcherHome.stats.bb++;
                let runs = advanceRunners(bases, "BB");
                awayScore += runs; curPitcherHome.stats.er += runs; curPitcherHomeErInMatch += runs; b.stats.rbi += runs;
            } else if(rand < bbP + soP) {
                outs++; b.stats.so++; curPitcherHome.stats.so++;
                curPitcherHome.stats.ipOuts++; currentInningOutsHome++; 
            } else {
                const gb_p = parseFloat(document.getElementById('hit_gb').value);
                const fb_p = parseFloat(document.getElementById('hit_fb').value);
                const ld_p = parseFloat(document.getElementById('hit_ld').value);
                let rand_type = Math.random() * (gb_p + fb_p + ld_p);
                let hitType = rand_type < gb_p ? "GB" : (rand_type < gb_p + fb_p ? "FB" : "LD");
                
                let baseHitChance = hitType === "GB" ? 0.32 : (hitType === "FB" ? 0.28 : 0.76);
                let h9Effect = (55 - curPitcherHome.h9) * 0.0012; 
                let finalHitChance = Math.max(0.18, Math.min(0.92, baseHitChance + h9Effect));

                if(Math.random() < finalHitChance) {
                    let hr9Reduction = (curPitcherHome.hr9 / 100) * 0.35; 
                    let finalBarrel = (b.barrel / 100) * (1 - hr9Reduction);
                    
                    let kind = "1B";
                    if ((hitType === "FB" || hitType === "LD") && Math.random() < finalBarrel) {
                        kind = "HR"; b.stats.hr++;
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
                    }
                    pitchCountAway = 0; curPitcherAwayErInMatch = 0; currentInningOutsAway = 0;
                }
            }
            
            let currentBattersHome = home.batters.filter(bat => bat.role !== "控え" && bat.role.includes("番"));
            let b = currentBattersHome[homeOrder];
            
            if(!b) {
                outs++; curPitcherAway.stats.ipOuts++; currentInningOutsAway++;
                homeOrder = (homeOrder + 1) % (currentBattersHome.length || 9);
                continue;
            }

            b.stats.ab++; pitchCountAway += 4;
            let bbP = (b.bb/100) + ((100 - curPitcherAway.bb9)*0.0006);
            let soP = (b.so/100) + (curPitcherAway.k9*0.001);
            let rand = Math.random();
            
            if(rand < bbP) {
                b.stats.bb++; curPitcherAway.stats.bb++;
                let runs = advanceRunners(bases, "BB");
                homeScore += runs; curPitcherAway.stats.er += runs; curPitcherAwayErInMatch += runs; b.stats.rbi += runs;
            } else if(rand < bbP + soP) {
                outs++; b.stats.so++; curPitcherAway.stats.so++;
                curPitcherAway.stats.ipOuts++; currentInningOutsAway++; 
            } else {
                const gb_p = parseFloat(document.getElementById('hit_gb').value);
                const fb_p = parseFloat(document.getElementById('hit_fb').value);
                const ld_p = parseFloat(document.getElementById('hit_ld').value);
                let rand_type = Math.random() * (gb_p + fb_p + ld_p);
                let hitType = rand_type < gb_p ? "GB" : (rand_type < gb_p + fb_p ? "FB" : "LD");
                
                let baseHitChance = hitType === "GB" ? 0.32 : (hitType === "FB" ? 0.28 : 0.76);
                let h9Effect = (55 - curPitcherAway.h9) * 0.0015;
                let finalHitChance = Math.max(0.18, Math.min(0.92, baseHitChance + h9Effect));

                if(Math.random() < finalHitChance) {
                    let hr9Reduction = (curPitcherAway.hr9 / 100) * 0.35;
                    let finalBarrel = (b.barrel / 100) * (1 - hr9Reduction);
                    
                    let kind = "1B";
                    if ((hitType === "FB" || hitType === "LD") && Math.random() < finalBarrel) {
                        kind = "HR"; b.stats.hr++;
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
    document.getElementById("quick_match_results").innerHTML = res.map(r => `<tr><td><b>${r}</b></td></tr>`).join("");
    updateUIAll();
}

function playOneWeek() {
    let lastRes = null;
    for(let i=0; i<6; i++) { let res = simulateRound(); if(res) lastRes = res; }
    if(lastRes) {
        document.getElementById("quick_match_results").innerHTML = "<tr><td style='color:green;'><b>一週間分(6カード)を一括消化しました</b></td></tr>" + lastRes.map(r => `<tr><td>${r}</td></tr>`).join("");
    }
    updateUIAll();
}

function playAllSeason() {
    while(totalGamesPlayed < MAX_GAMES) { simulateRound(); }
    document.getElementById("quick_match_results").innerHTML = "<tr><td style='color:orange; font-weight:bold;'>143試合全日程終了しました！</td></tr>";
    updateUIAll();
}

function resetSeason() {
    totalGamesPlayed = 0; initializeLeagueData();
    document.getElementById("quick_match_results").innerHTML = "<tr><td>シーズンをリセットしました。</td></tr>";
    onEditorTeamChange(); updateUIAll();
}

function onEditorTeamChange() {
    let teamIdx = parseInt(document.getElementById("edit_team_select").value);
    let team = teams[teamIdx];
    let playerSelect = document.getElementById("edit_player_select");
    playerSelect.innerHTML = "";

    team.batters.forEach((p, idx) => { playerSelect.innerHTML += `<option value="bat_${idx}">[野手] ${p.role} - ${p.name}</option>`; });
    team.pitchers.forEach((p, idx) => { playerSelect.innerHTML += `<option value="pit_${idx}">[投手] ${p.role} - ${p.name}</option>`; });
    playerSelect.selectedIndex = 0; onEditorPlayerChange();
}

function onEditorPlayerChange() {
    let teamIdx = parseInt(document.getElementById("edit_team_select").value);
    let playerVal = document.getElementById("edit_player_select").value;
    if(!playerVal) return;
    
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
    let teamIdx = parseInt(document.getElementById("edit_team_select").value);
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
    document.getElementById("editor_dup_warning").style.display = (uniqLen < 8) ? "block" : "none";

    let savedIndex = document.getElementById("edit_player_select").selectedIndex;
    onEditorTeamChange(); document.getElementById("edit_player_select").selectedIndex = savedIndex;
    updateUIAll();
}

function updateUIAll() {
    document.getElementById("current_game_count").innerText = totalGamesPlayed;
    document.getElementById("current_week_count").innerText = Math.floor(totalGamesPlayed / 6) + 1;
    
    let sorted = [...teams].sort((a,b) => (b.wins / ((b.wins + b.losses) || 1)) - (a.wins / ((a.wins + a.losses) || 1)));
    let sBody = document.getElementById("standings_body"); sBody.innerHTML = "";
    sorted.forEach((t, i) => {
        let wp = t.wins / ((t.wins + t.losses) || 1);
        sBody.innerHTML += `<tr><td>${i+1}</td><td><b>${t.name}</b></td><td>${t.wins}</td><td>${t.losses}</td><td>${t.draws}</td><td>${wp.toFixed(3)}</td><td>-</td></tr>`;
    });

    let bList = []; teams.forEach(t => t.batters.forEach(b => bList.push({tName: t.name, data: b})));
    bList.sort((a,b) => (b.data.stats.hits / (b.data.stats.ab || 1)) - (a.data.stats.hits / (a.data.stats.ab || 1)));
    let batBody = document.querySelector("#batting_stats_table tbody"); batBody.innerHTML = "";
    bList.slice(0, 15).forEach(item => {
        let b = item.data; let avg = b.stats.hits / (b.stats.ab || 1);
        batBody.innerHTML += `<tr><td>${item.tName}</td><td><b>${b.name}</b></td><td>${b.currentPos}</td><td>${avg.toFixed(3)}</td><td>${b.stats.games}</td><td>${b.stats.ab}</td><td>${b.stats.hits}</td><td>${b.stats.hr}</td><td>${b.stats.rbi}</td><td>${b.stats.bb}</td></tr>`;
    });

    let pList = []; teams.forEach(t => t.pitchers.forEach(p => pList.push({tName: t.name, data: p})));
    pList.sort((a,b) => {
        if(a.data.stats.ipOuts === 0) return 1; if(b.data.stats.ipOuts === 0) return -1;
        return a.data.stats.era - b.data.stats.era;
    });
    let pitBody = document.querySelector("#pitching_stats_table tbody"); pitBody.innerHTML = "";
    pList.forEach(item => {
        let p = item.data;
        pitBody.innerHTML += `<tr><td>${item.tName}</td><td><b>${p.name}</b></td><td>${p.role}</td><td><b>${p.stats.ipOuts > 0 ? p.stats.era.toFixed(2) : '-.--'}</b></td><td>${p.stats.appearances}</td><td>${p.stats.wins}</td><td>${p.stats.losses}</td><td><b>${p.stats.saves}</b></td><td>${formatInningsPitched(p.stats.ipOuts)}</td><td>${p.stats.so}</td><td>${p.staCurrent}</td></tr>`;
    });
}

function switchTab(tabId, el) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active'); el.classList.add('active');
}

// 初期起動処理
initializeLeagueData();
onEditorTeamChange();
updateUIAll();
