/**
 * Baseball Tycoon: Offseason & Draft Engine
 * このモジュールはペナントレース終了後の「チーム再構築」を担当します。
 */

// ドラフト候補生のデータベース
let draftPool = { batters: [], pitchers: [] };
let currentDraftRound = 1;
let maxDraftRounds = 10;
const userTeamId = 0; // ユーザーのチームID

/**
 * 戦力外通告フェーズの開始
 * 全チームの成績を評価し、WARが低い選手を解雇候補として提示します。
 */
function startUserReleasePhase() {
    console.log("=== オフシーズン開始：戦力外通告フェーズ ===");
    
    // UIの切り替え
    document.getElementById("main_game_container").style.display = "none";
    document.getElementById("offseason_container").style.display = "block";

    // ユーザーチームの選手を表示するロジック
    // 選手一人ひとりのStatsからWARを算出し、リストアップする
    let myTeam = teams[userTeamId];
    renderReleaseList(myTeam);
}

/**
 * ドラフト指名ロジック
 * CPUは単なるランダム指名ではなく、チームの「WAR合計値」が低いポジションを
 * 優先的に補強する、より人間らしい挙動を目指します。
 */
function executeCPUDraft(round) {
    teams.forEach(t => {
        if (t.id === userTeamId) return; // ユーザーは除外

        // CPUのチーム状態を分析
        let teamWar = calculateTeamWar(t);
        let targetType = teamWar.batters < teamWar.pitchers ? 'bat' : 'pit';

        let available = targetType === 'bat' ? 
            draftPool.batters.filter(b => !b.isDrafted) : 
            draftPool.pitchers.filter(p => !p.isDrafted);

        if (available.length > 0) {
            // 能力値(potential)が高い順にソートして指名
            available.sort((a, b) => b.potential - a.potential);
            let pick = available[0];
            pick.isDrafted = true;
            
            // チームへ追加
            if (targetType === 'bat') t.batters.push(pick);
            else t.pitchers.push(pick);
            
            console.log(`${t.name} が ${pick.name} を指名しました。`);
        }
    });
}

/**
 * チームの現状を評価するユーティリティ
 */
function calculateTeamWar(team) {
    let batWar = team.batters.reduce((sum, b) => sum + (b.stats.war || 0), 0);
    let pitWar = team.pitchers.reduce((sum, p) => sum + (p.stats.war || 0), 0);
    return { batters: batWar, pitchers: pitWar };
}

/**
 * 新シーズンの開幕処理
 * ドラフト終了後、全チームのスタッツをリセットし、
 * 若手選手の成長（ポテンシャルに基づく成長判定）を計算します。
 */
function finalizeOffseason() {
    console.log("=== 新シーズン開幕準備 ===");

    teams.forEach(t => {
        // 全選手の年齢を+1し、成長判定を行う
        t.batters.forEach(b => {
            b.age += 1;
            // 25歳前後で能力がピークに達するようなロジックを想定
            if (b.age < 26) {
                b.potential += Math.random() * 2;
            }
        });
        
        // 成績のリセット処理
        t.wins = 0; t.losses = 0; t.draws = 0;
        // ...その他スタッツ初期化...
    });
    
    alert("ドラフト会議および補強が完了しました。新シーズン開幕です！");
    location.reload(); // 簡易的にページ再読み込みでリセット
}

/**
 * ヘルパー：ドラフト候補生をランダム生成する
 */
function createDraftBatter() {
    return {
        name: generateRandomPlayerName(),
        age: 18 + Math.floor(Math.random() * 4),
        potential: 50 + Math.random() * 50, // 0-100の能力値
        isop: 0.15 + Math.random() * 0.1,
        barrel: 5 + Math.random() * 10,
        currentPos: ["捕手", "一塁手", "二塁手", "三塁手", "遊撃手", "外野手"][Math.floor(Math.random() * 6)],
        graduation: "高校",
        isDrafted: false
    };
}
