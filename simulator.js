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

function updateUIAll() {
    document.getElementById("current_game_count").innerText = totalGamesPlayed;
    
    // 順位表の更新（勝数でソート）
    let sorted = [...teams].sort((a,b) => b.wins - a.wins);
    let sBody = document.getElementById("standings_body");
    sBody.innerHTML = sorted.map((t, i) => `<tr><td>${i+1}</td><td>${t.name}</td><td>${t.wins}</td></tr>`).join("");
    
    // 個人成績の更新（例として先頭選手のみ）
    let bBody = document.querySelector("#batting_stats_table tbody");
    if(bBody) {
        bBody.innerHTML = teams[0].batters.slice(0, 5).map(b => 
            `<tr><td>${b.name}</td><td>---</td><td>${b.stats.war.toFixed(1)}</td></tr>`
        ).join("");
    }
}
