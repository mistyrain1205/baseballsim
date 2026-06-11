// 試合の勝敗を計算して表示するロジックを追加
function simulateRound() {
    if (totalGamesPlayed >= MAX_GAMES) return null;
    
    let results = [];
    // 全チームでランダムに試合を組んで勝敗をつける
    for (let i = 0; i < teams.length; i += 2) {
        let teamA = teams[i];
        let teamB = teams[i+1];
        if (!teamB) break;
        
        // 簡易勝敗判定
        if (Math.random() > 0.5) {
            teamA.wins++;
            results.push(`${teamA.name} win vs ${teamB.name}`);
        } else {
            teamB.wins++;
            results.push(`${teamB.name} win vs ${teamA.name}`);
        }
    }
    
    totalGamesPlayed++;
    return results;
}

function playNextRound() {
    let results = simulateRound();
    if (results) {
        let rEl = document.getElementById("quick_match_results");
        if(rEl) rEl.innerHTML = results.map(r => `<tr><td>${r}</td></tr>`).join("");
    }
    updateUIAll();
}

// --- (中略：これまでの simulateRound 等の関数はそのまま) ---

function updateUIAll() {
    // 試合数を更新
    document.getElementById("current_game_count").innerText = totalGamesPlayed;
    
    // 順位表の更新
    let sorted = [...teams].sort((a,b) => b.wins - a.wins);
    let sBody = document.getElementById("standings_body");
    if(sBody) {
        sBody.innerHTML = sorted.map((t, i) => `<tr><td>${i+1}</td><td>${t.name}</td><td>${t.wins}</td></tr>`).join("");
    }
    
    // 個人成績の更新
    let bBody = document.querySelector("#batting_stats_table tbody");
    if(bBody) {
        let rows = "";
        teams.forEach(t => {
            t.batters.slice(0, 3).forEach(b => {
                rows += `<tr><td>${b.name}</td><td>---</td><td>${(b.stats.war || 0).toFixed(1)}</td></tr>`;
            });
        });
        bBody.innerHTML = rows;
    }
}

// 【重要】ここで関数を閉じて、その外側にイベントリスナーを配置する
window.addEventListener("DOMContentLoaded", () => {
    initializeLeagueData();
    // 0.1秒待ってから表示する
    setTimeout(() => {
        updateUIAll();
    }, 100);
});
