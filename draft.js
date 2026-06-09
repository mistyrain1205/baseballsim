// draft.js

let draftPool = { batters: [], pitchers: [] };
let currentDraftRound = 1; // 現在のドラフト巡 (1~3位まで)

// シーズン終了時に呼び出され、今年のドラフト候補生（野手10人、投手10人）を生成する
function generateDraftPool() {
    draftPool.batters = [];
    draftPool.pitchers = [];
    currentDraftRound = 1;

    for (let i = 0; i < 12; i++) {
        draftPool.batters.push(createDraftBatter());
        draftPool.pitchers.push(createDraftPitcher());
    }
    
    // UI側の獲得ログを初期化
    for(let r=1; r<=3; r++) {
        let el = document.getElementById(`my_draft_r${r}`);
        if(el) el.innerText = "-";
    }
    
    renderDraftPoolUI();
}

// ドラフト候補生の一覧表を画面に描画する
function renderDraftPoolUI() {
    let tbody = document.getElementById("draft_pool_body");
    if (!tbody) return;
    tbody.innerHTML = "";

    let idCounter = 0;

    // 野手候補の描画
    draftPool.batters.forEach((b, idx) => {
        if (b.isDrafted) return; // すでに指名済みの選手は出さない
        let row = `<tr>
            <td>野-${idx}</td>
            <td><b>${b.name}</b></td>
            <td><span style="color: #dd6b20; font-weight:bold;">野手</span></td>
            <td>${b.currentPos}</td>
            <td>${b.graduation}</td>
            <td>${b.age}歳</td>
            <td>長打指標(IsoP): <b>${b.isop}</b> / バレル: ${b.barrel.toFixed(1)}%</td>
            <td><button class="btn btn-success" style="padding: 3px 8px; font-size: 0.85em;" onclick="userSelectDraftPlayer('bat', ${idx})">指名する</button></td>
        </tr>`;
        tbody.innerHTML += row;
        idCounter++;
    });

    // 投手候補の描画
    draftPool.pitchers.forEach((p, idx) => {
        if (p.isDrafted) return;
        let pType = p.staMax > 50 ? "先発型" : "リリーフ型";
        let row = `<tr>
            <td>投-${idx}</td>
            <td><b>${p.name}</b></td>
            <td><span style="color: #2b6cb0; font-weight:bold;">投手(${pType})</span></td>
            <td>投手</td>
            <td>${p.graduation}</td>
            <td>${p.age}歳</td>
            <td>奪三振(K/9): <b>${p.k9}</b> / スタミナ: ${p.staMax}</td>
            <td><button class="btn btn-success" style="padding: 3px 8px; font-size: 0.85em;" onclick="userSelectDraftPlayer('pit', ${idx})">指名する</button></td>
        </tr>`;
        tbody.innerHTML += row;
        idCounter++;
    });
}

// ユーザーがボタンを押して選手を指名したときの処理
function userSelectDraftPlayer(type, index) {
    if (currentDraftRound > 3) {
        alert("今年のドラフト指名は3位まで終了しています。シーズンを進行させてください。");
        return;
    }

    let selectedPlayer = type === 'bat' ? draftPool.batters[index] : draftPool.pitchers[index];
    selectedPlayer.isDrafted = true;

    // 1. ユーザーの球団に選択した選手を追加
    let userTeam = teams[userTeamId];
    if (type === 'bat') {
        userTeam.batters.push(selectedPlayer);
    } else {
        userTeam.pitchers.push(selectedPlayer);
    }

    // 獲得ログを表示
    let resEl = document.getElementById(`my_draft_r${currentDraftRound}`);
    if (resEl) resEl.innerHTML = `<b style="color:green;">${selectedPlayer.name}</b> (${selectedPlayer.currentPos})`;

    // 2. CPU球団（他の5チーム）も残ったプールから自動で一番良い選手をスカウト指名する
    executeCPUDraft(currentDraftRound, type, index);

    // 巡を進める
    currentDraftRound++;

    // 全3巡が終わったらドラフトモードを閉じて、役割の再配置を行う
    if (currentDraftRound > 3) {
        document.getElementById("draft_status_message").innerText = "🎉 今年のドラフト会議はすべて終了しました！一軍ロスターが自動再編成されました。新しいシーズンへ進みましょう！";
        document.getElementById("draft_interaction_zone").style.display = "none";
        
        // 全チームのロスター役割を修復
        teams.forEach(t => reassignTeamRoles(t));
        updateUIAll();
    } else {
        renderDraftPoolUI(); // 画面を更新して指名された選手を消す
    }
}

// 他のライバルCPU球団の自動指名
function executeCPUDraft(round, userType, userIdx) {
    teams.forEach(t => {
        if (t.id === userTeamId) return; // ユーザーはスキップ

        // 野手・投手プールからランダム、またはバレル等の高い選手を1人ピック
        let cpuChoiceType = Math.random() < 0.5 ? 'bat' : 'pit';
        let picked = null;

        if (cpuChoiceType === 'bat') {
            let available = draftPool.batters.filter(b => !b.isDrafted);
            if (available.length > 0) {
                available.sort((a, b) => b.barrel - a.barrel); // 一番バレル率の高い良い野手を選ぶ
                picked = available[0];
            }
        }
        
        if (!picked) { // 投手を選ぶか、野手が空だった場合
            let availableP = draftPool.pitchers.filter(p => !p.isDrafted);
            if (availableP.length > 0) {
                availableP.sort((a, b) => b.k9 - a.k9); // 奪三振の優秀な投手を選ぶ
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
