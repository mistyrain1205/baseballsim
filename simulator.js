function simulateRound() {
    if (totalGamesPlayed >= MAX_GAMES) return null;
    
    let results = [];
    teams.forEach(t => {
        // 簡易試合計算：全打者にランダムに安打を加算
        t.batters.forEach(b => {
            if(Math.random() > 0.7) { // 30%の確率でヒット
                b.stats.ab += 1;
                b.stats.hits += 1;
            } else {
                b.stats.ab += 1;
            }
        });
        // チームの勝敗
        if (Math.random() > 0.5) t.wins++;
    });
    
    totalGamesPlayed++;
    return results;
}

function playNextRound() {
    simulateRound();
    updateUIAll();
}

function updateUIAll() {
    // 1. WARと打率の再計算処理
    teams.forEach(t => {
        t.batters.forEach(b => {
            let avg = b.stats.hits / (b.stats.ab || 1);
            // 打率とWARを計算
            b.stats.war = (avg - 0.250) * 20; 
            b.stats.avg = avg;
        });
    });

    // 2. 進行度と順位表更新
    document.getElementById("current_game_count").innerText = totalGamesPlayed;
    let sBody = document.getElementById("standings_body");
    let sorted = [...teams].sort((a,b) => b.wins - a.wins);
    if(sBody) sBody.innerHTML = sorted.map((t, i) => `<tr><td>${i+1}</td><td>${t.name}</td><td>${t.wins}</td></tr>`).join("");
    
    // 3. 個人成績表の更新（打率とWARを反映）
    let bBody = document.querySelector("#batting_stats_table tbody");
    if(bBody) {
        let rows = "";
        teams.forEach(t => {
            t.batters.slice(0, 3).forEach(b => {
                rows += `<tr><td>${b.name}</td><td>${(b.stats.avg || 0).toFixed(3)}</td><td>${(b.stats.war || 0).toFixed(1)}</td></tr>`;
            });
        });
        bBody.innerHTML = rows;
    }
}
