// draft.js

let draftPool = { batters: [], pitchers: [] };
let currentDraftRound = 1; 
let userReleaseList = { batters: [], pitchers: [] }; 
let maxDraftRounds = 0; 

// シーズン終了時に呼び出され、手動戦力外通告画面を構築する
function startUserReleasePhase() {
    userReleaseList.batters = [];
    userReleaseList.pitchers = [];
    
    let relCountEl = document.getElementById("ui_release_count");
    if(relCountEl) relCountEl.innerText = "0";
    
    let myTeam = teams[userTeamId];
    if(!myTeam) return;
    
    // 野手解雇リストの描画（今季の成績とWARを表示！）
    let bBody = document.getElementById("release_batters_body");
    if(bBody) {
        bBody.innerHTML = myTeam.batters.map((b, idx) => {
            let roleText = b.role >= 1 && b.role <= 9 ? `${b.role}番` : (b.role === 0 ? "一軍控" : "二軍");
            let avg = b.stats.hits / (b.stats.ab || 1);
            let warColor = b.stats.war >= 2.0 ? "color:green; font-weight:bold;" : (b.stats.war < 0 ? "color:red; font-weight:bold;" : "");
            
            return `<tr>
                <td><input type="checkbox" class="rel-check-bat" value="${idx}" onchange="updateReleaseCount()"></td>
                <td>[${roleText}] <b>${b.name}</b> (${b.age}歳)</td>
                <td style="text-align:left; color:#4a5568;">.${Math.floor(avg*1000)} ${b.stats.hr}本 ${b.stats.rbi}打点</td>
                <td style="${warColor}">WAR: ${b.stats.war.toFixed(1)}</td>
            </tr>`;
        }).join("");
    }

    // 投手解雇リストの描画（今季の成績とWARを表示！）
    let pBody = document.getElementById("release_pitchers_body");
    if(pBody) {
        pBody.innerHTML = myTeam.pitchers.map((p, idx) => {
            let eraText = p.stats.ipOuts > 0 ? p.stats.era.toFixed(2) : "-.--";
            let warColor = p.stats.war >= 2.0 ? "color:green; font-weight:bold;" : (p.stats.war < 0 ? "color:red; font-weight:bold;" : "");
            let ipText = Math.floor(p.stats.ipOuts / 3);
            
            return `<tr>
                <td><input type="checkbox" class="rel-check-pit" value="${idx}" onchange="updateReleaseCount()"></td>
                <td>[${p.role}] <b>${p.name}</b> (${p.age}歳)</td>
                <td style="text-align:left; color:#4a5568;">防 ${eraText} | ${p.stats.wins}勝${p.stats.losses}敗 ${ipText}回</td>
                <td style="${warColor}">WAR: ${p.stats.war.toFixed(1)}</td>
            </tr>`;
        }).join("");
    }

    let relZone = document.getElementById("offseason_release_zone");
    if(relZone) relZone.style.display = "flex";
    
    let drfZone = document.getElementById("draft_interaction_zone");
    if(drfZone) drfZone.style.display = "none";
}

function updateReleaseCount() {
    let batChecks = document.querySelectorAll(".rel-check-bat:checked").length;
    let pitChecks = document.querySelectorAll(".rel-check-pit:checked").length;
    let total = batChecks + pitChecks;
    
    let relCountEl = document.getElementById("ui_release_count");
    if(relCountEl) relCountEl.innerText = total;
    
    if(total > 10) {
        alert("戦力外通告は最大10名までです！枠数を調整してください。");
    }
}

function finalizeUserReleases() {
    let batChecked = Array.from(document.querySelectorAll(".rel-check-bat:checked")).map(el => parseInt(el.value));
    let pitChecked = Array.from(document.querySelectorAll(".rel-check-pit:checked")).map(el => parseInt(el.value));
    let total = batChecked.length + pitChecked.length;

    if (total === 0) {
        alert("最低1名は戦力外通告（解雇）を行ってください。");
        return;
    }
    if (total > 10) {
        alert("10名を超えています。自由契約にする選手を絞り込んでください。");
        return;
    }

    maxDraftRounds = total; 
    
    let quotaEl = document.getElementById("ui_draft_quota");
    if(quotaEl) quotaEl.innerText = maxDraftRounds;

    let myTeam = teams[userTeamId];
    
    myTeam.batters = myTeam.batters.filter((_, idx) => !batChecked.includes(idx));
    myTeam.pitchers = myTeam.pitchers.filter((_, idx) => !pitChecked.includes(idx));

    executeCPUReleases();
    generateDraftPool();
}

function executeCPUReleases() {
    teams.forEach(t => {
        if (t.id === userTeamId) return;
        // CPUはWARの低い実質足を引っ張っている選手から順に3人解雇する賢いAIに変更
        t.batters.sort((a,b) => a.stats.war - b.stats.war);
        t.batters.splice(0, 3); 
        t.pitchers.sort((a,b) => a.stats.war - b.stats.war);
        t.pitchers.splice(0, 3); 
    });
}

function generateDraftPool() {
    draftPool.batters = [];
    draftPool.pitchers = [];
    currentDraftRound = 1;

    for (let i = 0; i < 35; i++) {
        let bat = createDraftBatter();
        let amAvg = (0.240 + Math.random() * 0.120) + (bat.barrel * 0.003);
        let amHr = Math.floor((bat.isop * 0.4) + Math.random() * 5);
        bat.amateurStats = `【アマ通算】打率.${Math.floor(amAvg*1000)}  ${amHr}本塁打`;
        
        let batTitles = ["なし", "なし", "高校日本代表", "甲子園優勝", "リーグ戦MVP", "社会人ベストナイン", "首位打者"];
        bat.amateurTitle = batTitles[Math.floor(Math.random() * batTitles.length)];
        bat.isDrafted = false;
        draftPool.batters.push(bat);

        let pit = createDraftPitcher();
        let amEra = Math.max(0.80, (5.50 - (pit.k9 * 0.04)) + (Math.random() * 1.5));
        let amWins = Math.floor((pit.h9 * 0.1) + Math.random() * 8);
        pit.amateurStats = `【アマ通算】防御率 ${amEra.toFixed(2)}  ${amWins}勝`;
        
        let pitTitles = ["なし", "なし", "甲子園準優勝", "最優秀投手賞", "全日本選手権優勝", "ノーヒットノーラン達成", "高校ビッグ3"];
        pit.amateurTitle = pitTitles[Math.floor(Math.random() * pitTitles.length)];
        pit.isDrafted = false;
        draftPool.pitchers.push(pit);
    }
    
    let resBody = document.getElementById("my_draft_results_body");
    if(resBody) {
        resBody.innerHTML = "";
        for(let r=1; r<=maxDraftRounds; r++) {
            resBody.innerHTML += `<tr><td>${r}位</td><td id="my_draft_r${r}">-</td></tr>`;
        }
    }
    
    let relZone = document.getElementById("offseason_release_zone");
    if(relZone) relZone.style.display = "none";
    
    let drfZone = document.getElementById("draft_interaction_zone");
    if(drfZone) drfZone.style.display = "grid";
    
    let roundTitleEl = document.getElementById("ui_draft_round_title");
    if(roundTitleEl) roundTitleEl.innerText = `今年のドラフト候補生一覧 (第 1 巡目指名 / 最大 ${maxDraftRounds} 巡)`;
    
    renderDraftPoolUI();
}

function renderDraftPoolUI() {
    let tbody = document.getElementById("draft_pool_body");
    if (!tbody) return;
    tbody.innerHTML = "";

    draftPool.batters.forEach((b, idx) => {
        if (b.isDrafted) return;
        let titleBadge = b.amateurTitle !== "なし" ? `<span style="background:#e53e3e; color:white; padding:2px 5px; border-radius:3px; font-size:0.8em; margin-left:5px;">${b.amateurTitle}</span>` : "";
        tbody.innerHTML += `<tr>
            <td>野-${idx}</td>
            <td><b>${b.name}</b>${titleBadge}</td>
            <td><span style="color: #dd6b20; font-weight:bold;">野手</span></td>
            <td>${b.currentPos}</td>
            <td>${b.graduation}</td>
            <td>${b.age}歳</td>
            <td style="text-align:left; padding-left:10px;"><b>${b.amateurStats}</b><br><small style="color:#718096;">(能力目安: IsoP ${b.isop} / 弾道 ${b.barrel.toFixed(1)}%)</small></td>
            <td><button class="btn btn-success" style="padding:4px 10px; font-size:0.85em;" onclick="userSelectDraftPlayer('bat', ${idx})">指名</button></td>
        </tr>`;
    });

    draftPool.pitchers.forEach((p, idx) => {
        if (p.isDrafted) return;
        let pType = p.staMax > 50 ? "先発型" : "リリーフ型";
        let titleBadge = p.amateurTitle !== "なし" ? `<span style="background:#2b6cb0; color:white; padding:2px 5px; border-radius:3px; font-size:0.8em; margin-left:5px;">${p.amateurTitle}</span>` : "";
        tbody.innerHTML += `<tr>
            <td>投-${idx}</td>
            <td><b>${p.name}</b>${titleBadge}</td>
            <td><span style="color: #2b6cb0; font-weight:bold;">投手(${pType})</span></td>
            <td>投手</td>
            <td>${p.graduation}</td>
            <td>${p.age}歳</td>
            <td style="text-align:left; padding-left:10px;"><b>${p.amateurStats}</b><br><small style="color:#718096;">(能力目安: K/9 ${p.k9} / 被安打 ${p.h9})</small></td>
            <td><button class="btn btn-success" style="padding:4px 10px; font-size:0.85em;" onclick="userSelectDraftPlayer('pit', ${idx})">指名</button></td>
        </tr>`;
    });
}

function userSelectDraftPlayer(type, index) {
    if (currentDraftRound > maxDraftRounds) return;

    let selectedPlayer = type === 'bat' ? draftPool.batters[index] : draftPool.pitchers[index];
    selectedPlayer.isDrafted = true;

    let userTeam = teams[userTeamId];
    if (type === 'bat') {
        userTeam.batters.push(selectedPlayer);
    } else {
        userTeam.pitchers.push(selectedPlayer);
    }

    let resEl = document.getElementById(`my_draft_r${currentDraftRound}`);
    if (resEl) resEl.innerHTML = `<b style="color:#2b6cb0;">${selectedPlayer.name}</b> <small>(${selectedPlayer.currentPos})</small>`;

    executeCPUDraft(currentDraftRound);
    currentDraftRound++;

    if (currentDraftRound > maxDraftRounds) {
        let statusMsgEl = document.getElementById("draft_status_message");
        if(statusMsgEl) statusMsgEl.innerHTML = "🎉 <b>オフシーズン補強・ドラフト会議がすべて完了しました！</b>";
        
        currentYear += 1; 
        totalGamesPlayed = 0;

        teams.forEach(t => {
            t.wins = 0; t.losses = 0; t.draws = 0;
            t.batters.forEach(b => b.stats = { games: 0, ab: 0, hits: 0, hr: 0, rbi: 0, bb: 0, so: 0, war: 0.0 });
            t.pitchers.forEach(p => {
                p.staCurrent = p.staMax;
                p.stats = { era: 0, appearances: 0, wins: 0, losses: 0, saves: 0, ipOuts: 0, so: 0, bb: 0, er: 0, war: 0.0 };
            });
            reassignTeamRoles(t);
        });

        updateUIAll();
        setTimeout(() => {
            alert(`祝・ペナント第 ${currentYear} 年目 開幕！\nあなたが自ら厳選解雇・指名獲得した新ロスターで新シーズンが始まります！`);
            switchTab('tab-stats-bat', document.querySelectorAll('.tab')[0]);
        }, 200);
    } else {
        let roundTitleEl = document.getElementById("ui_draft_round_title");
        if(roundTitleEl) roundTitleEl.innerText = `今年のドラフト候補生一覧 (第 ${currentDraftRound} 巡目指名 / 最大 ${maxDraftRounds} 巡)`;
        renderDraftPoolUI();
    }
}

function executeCPUDraft(round) {
    teams.forEach(t => {
        if (t.id === userTeamId) return;
        if (round > 6) return; 

        let cpuChoiceType = Math.random() < 0.5 ? 'bat' : 'pit';
        let picked = null;

        if (cpuChoiceType === 'bat') {
            let available = draftPool.batters.filter(b => !b.isDrafted);
            if (available.length > 0) {
                available.sort((a, b) => b.barrel - a.barrel);
                picked = available[0];
            }
        }
        if (!picked) {
            let availableP = draftPool.pitchers.filter(p => !p.isDrafted);
            if (availableP.length > 0) {
                availableP.sort((a, b) => b.k9 - a.k9);
                picked = availableP[0];
            }
        }

        if (picked) {
            picked.isDrafted = true;
            if (picked.originalPos === "投手") {
                t.pitchers.push(picked);
            } else {
                t.batters.push(picked);
            }
        }
    });
}
