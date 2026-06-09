// draft.js

let draftPool = { batters: [], pitchers: [] };
let currentDraftRound = 1; 

function generateDraftPool() {
    draftPool.batters = [];
    draftPool.pitchers = [];
    currentDraftRound = 1;

    for (let i = 0; i < 15; i++) { // プールを少し多めの15人ずつに拡大
        let bat = createDraftBatter();
        // 🆕 アマチュア打撃成績とタイトルのシミュレート
        let amAvg = (0.240 + Math.random() * 0.120) + (bat.barrel * 0.003);
        let amHr = Math.floor((bat.isop * 0.4) + Math.random() * 5);
        bat.amateurStats = `【アマ通算】打率.${Math.floor(amAvg*1000)}  ${amHr}本塁打`;
        
        let batTitles = ["なし", "なし", "高校日本代表", "甲子園優勝", "リーグ戦MVP", "社会人ベストナイン", "首位打者"];
        bat.amateurTitle = batTitles[Math.floor(Math.random() * batTitles.length)];
        bat.isDrafted = false;
        draftPool.batters.push(bat);

        let pit = createDraftPitcher();
        // 🆕 アマチュア投手成績とタイトルのシミュレート
        let amEra = Math.max(0.80, (5.50 - (pit.k9 * 0.04)) + (Math.random() * 1.5));
        let amWins = Math.floor((pit.h9 * 0.1) + Math.random() * 8);
        pit.amateurStats = `【アマ通算】防御率 ${amEra.toFixed(2)}  ${amWins}勝`;
        
        let pitTitles = ["なし", "なし", "甲子園準優勝", "最優秀投手賞", "全日本選手権優勝", "ノーヒットノーラン達成", "高校ビッグ3"];
        pit.amateurTitle = pitTitles[Math.floor(Math.random() * pitTitles.length)];
        pit.isDrafted = false;
        draftPool.pitchers.push(pit);
    }
    
    for(let r=1; r<=3; r++) {
        let el = document.getElementById(`my_draft_r${r}`);
        if(el) el.innerText = "-";
    }
    
    renderDraftPoolUI();
}

function renderDraftPoolUI() {
    let tbody = document.getElementById("draft_pool_body");
    if (!tbody) return;
    tbody.innerHTML = "";

    // 野手候補の描画
    draftPool.batters.forEach((b, idx) => {
        if (b.isDrafted) return;
        let titleBadge = b.amateurTitle !== "なし" ? `<span style="background:#e53e3e; color:white; padding:2px 5px; border-radius:3px; font-size:0.8em; margin-left:5px;">${b.amateurTitle}</span>` : "";
        let row = `<tr>
            <td>野-${idx}</td>
            <td><b>${b.name}</b>${titleBadge}</td>
            <td><span style="color: #dd6b20; font-weight:bold;">野手</span></td>
            <td>${b.currentPos}</td>
            <td>${b.graduation}</td>
            <td>${b.age}歳</td>
            <td style="text-align:left; padding-left:10px; color:#2d3748;"><b>${b.amateurStats}</b><br><small style="color:#718096;">(能力目安: IsoP ${b.isop} / 弾道 ${b.barrel.toFixed(1)}%)</small></td>
            <td><button class="btn btn-success" style="padding:4px 10px; font-size:0.85em;" onclick="userSelectDraftPlayer('bat', ${idx})">指名</button></td>
        </tr>`;
        tbody.innerHTML += row;
    });

    // 投手候補の描画
    draftPool.pitchers.forEach((p, idx) => {
        if (p.isDrafted) return;
        let pType = p.staMax > 50 ? "先発型" : "リリーフ型";
        let titleBadge = p.amateurTitle !== "なし" ? `<span style="background:#2b6cb0; color:white; padding:2px 5px; border-radius:3px; font-size:0.8em; margin-left:5px;">${p.amateurTitle}</span>` : "";
        let row = `<tr>
            <td>投-${idx}</td>
            <td><b>${p.name}</b>${titleBadge}</td>
            <td><span style="color: #2b6cb0; font-weight:bold;">投手(${pType})</span></td>
            <td>投手</td>
            <td>${p.graduation}</td>
            <td>${p.age}歳</td>
            <td style="text-align:left; padding-left:10px; color:#2d3748;"><b>${p.amateurStats}</b><br><small style="color:#718096;">(能力目安: K/9 ${p.k9} / 被安打抑制 ${p.h9})</small></td>
            <td><button class="btn btn-success" style="padding:4px 10px; font-size:0.85em;" onclick="userSelectDraftPlayer('pit', ${idx})">指名</button></td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

function userSelectDraftPlayer(type, index) {
    if (currentDraftRound > 3) return;

    let selectedPlayer = type === 'bat' ? draftPool.batters[index] : draftPool.pitchers[index];
    selectedPlayer.isDrafted = true;

    // ユーザー球団（配列の末尾）へ完全追加
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

    if (currentDraftRound > 3) {
        document.getElementById("draft_status_message").innerHTML = "🎉 <b>ドラフト会議が終了しました！</b>";
        
        // 🆕【重要バグ修正】新シーズン開幕に伴う「全所属選手のデータ初期化」をここで行う
        // 配列（ルーキーがpushされた後の状態）を維持したまま、通算年数増加とスタッツのみを真っ新にする
        currentYear += 1; 
        totalGamesPlayed = 0;

        teams.forEach(t => {
            t.wins = 0; t.losses = 0; t.draws = 0;
            // 既存選手もルーキーも全員生存させたまま、シーズン成績だけを0にリセット
            t.batters.forEach(b => {
                b.stats = { games: 0, ab: 0, hits: 0, hr: 0, rbi: 0, bb: 0, so: 0 };
            });
            t.pitchers.forEach(p => {
                p.staCurrent = p.staMax;
                p.stats = { era: 0, appearances: 0, wins: 0, losses: 0, saves: 0, ipOuts: 0, so: 0, bb: 0, er: 0 };
            });
            
            // 打順・投手配置の完全な再配置
            reassignTeamRoles(t);
        });

        updateUIAll();
        setTimeout(() => {
            alert(`祝・ペナント第 ${currentYear} 年目 開幕！\n獲得したルーキーを二軍ロスターに格納し、チームを再編成しました！`);
            switchTab('tab-stats-bat', document.querySelectorAll('.tab')[0]); // 成績タブに戻す
        }, 200);
    } else {
        renderDraftPoolUI();
    }
}

function executeCPUDraft(round) {
    teams.forEach(t => {
        if (t.id === userTeamId) return;

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
