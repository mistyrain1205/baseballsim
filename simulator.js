function simulateRound() {
    totalGamesPlayed++;
    // ここに試合の計算ロジック（後で詳細版に戻します）
    teams.forEach(t => t.wins += Math.random() > 0.5 ? 1 : 0);
    return "試合終了";
}

function playNextRound() {
    simulateRound();
    updateUIAll();
}

function updateUIAll() {
    document.getElementById("current_game_count").innerText = totalGamesPlayed;
    
    // 順位表の更新
    let sBody = document.getElementById("standings_body");
    sBody.innerHTML = teams.map((t, i) => `<tr><td>${i+1}</td><td>${t.name}</td><td>${t.wins}</td></tr>`).join("");
    
    // 個人成績の更新（とりあえず自チームの最初の選手だけ表示するテスト）
    let bBody = document.querySelector("#batting_stats_table tbody");
    if(bBody && teams[0]) {
        bBody.innerHTML = teams[0].batters.slice(0, 5).map(b => 
            `<tr><td>${b.name}</td><td>---</td><td>${b.stats.war.toFixed(1)}</td></tr>`
        ).join("");
    }
}

window.addEventListener("DOMContentLoaded", () => {
    initializeLeagueData();
    updateUIAll();
});
