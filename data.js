// data.js
const positions = ["捕手", "一塁手", "二塁手", "三塁手", "遊撃手", "左翼手", "中堅手", "右翼手", "投手"];
const teamNames = ["大阪", "東京", "横浜", "西海", "京都", "浪速"];

let totalGamesPlayed = 0;
const MAX_GAMES = 143;
let teams = [];

// 調子の定義
const conditions = ["絶好調", "好調", "普通", "不調", "絶不調"];

function initializeLeagueData() {
    teams = [];
    for(let t=0; t<6; t++) {
        let teamObj = {
            id: t,
            name: teamNames[t],
            wins: 0, losses: 0, draws: 0,
            rotationIdx: 0,
            batters: [],
            pitchers: []
        };
        
        // 野手20人生成 (スタメン9人 + 一軍控え7人 + 二軍4人 = 計20人)
        for(let i=1; i<=20; i++) {
            let isStamen = i <= 9;
            let isFirstTeam = i <= 16; // 1〜16番が一軍
            let pos = ["捕手","一塁手","二塁手","三塁手","遊撃手","左翼手","中堅手","右翼手","一塁手","捕手","内野手","内野手","外野手","外野手","外野手","内野手","内野手","外野手","捕手","内野手"][i-1];
            teamObj.batters.push({
                id: i-1,
                name: generateRandomPlayerName(),
                role: isStamen ? `${i}番` : (isFirstTeam ? "一軍控え" : "二軍"),
                originalPos: pos,
                currentPos: pos,
                condition: "普通", // 初期調子
                bb: isStamen ? [11, 9, 12, 15, 10, 8, 7, 7, 5][i-1] : 7.0,
                so: isStamen ? [14, 16, 15, 20, 18, 22, 23, 25, 30][i-1] : 22.0,
                barrel: isStamen ? [10, 12, 22, 30, 18, 14, 12, 10, 6][i-1] : 8.0, 
                isop: isStamen ? [15, 18, 30, 45, 24, 22, 18, 14, 8][i-1] : 12,    
                uzr: isStamen ? [3, 4, 1.5, 1.0, 3.5, 0, 1, 0.5, 0][i-1] : 0,
                err: 2.0,
                stats: { games: 0, ab: 0, hits: 0, hr: 0, rbi: 0, bb: 0, so: 0 }
            });
        }
        
        // 投手15人生成 (先発5人 + 一軍リリーフ6人 + 一軍守護神1人 + 二軍リリーフ3人 = 計15人)
        for(let i=1; i<=15; i++) {
            let isStarter = i <= 5;
            let isCloser = i === 12;
            let isFirstTeam = i <= 12; // 1〜12番が一軍(計12人)
            teamObj.pitchers.push({
                id: i-1,
                name: generateRandomPlayerName(),
                role: isFirstTeam ? (isCloser ? "守護神" : (isStarter ? "先発" : "リリーフ")) : "二軍リリーフ",
                currentPos: "投手",
                originalPos: "投手",
                condition: "普通",
                h9: isCloser ? 85 : (isStarter ? 60 + i : 65 + (i-5)), 
                k9: isCloser ? 88 : (isStarter ? 65 - i : 70 + (i-5)), 
                bb9: isCloser ? 80 : (isStarter ? 70 : 65),
                hr9: isCloser ? 55 : (isStarter ? 50 : 55), 
                staMax: isCloser ? 25 : (isStarter ? 95 : 35),
                staCurrent: isCloser ? 25 : (isStarter ? 95 : 35),
                stats: { era: 0, appearances: 0, wins: 0, losses: 0, saves: 0, ipOuts: 0, so: 0, bb: 0, er: 0 }
            });
        }
        teams.push(teamObj);
    }
}
