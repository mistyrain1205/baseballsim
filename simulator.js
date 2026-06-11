function simulateRound() {
    totalGamesPlayed++;
    teams.forEach(t => t.wins += Math.random() > 0.5 ? 1 : 0);
    return "試合終了";
}

function playNextRound() {
    simulateRound();
    updateUIAll();
}

function updateUIAll() {
    document.getElementById("current_game_count").innerText = totalGamesPlayed;
    let sBody = document.getElementById("standings_body");
    sBody.innerHTML = teams.map((t, i) => `<tr><td>${i+1}</td><td>${t.name}</td><td>${t.wins}</td></tr>`).join("");
}

// 最後に初期化を実行
window.addEventListener("DOMContentLoaded", () => {
    initializeLeagueData();
    updateUIAll();
});
