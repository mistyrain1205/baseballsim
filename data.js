// data.js
const positions = ["捕手", "一塁手", "二塁手", "三塁手", "遊撃手", "左翼手", "中堅手", "右翼手", "投手"];
const teamNames = ["大阪", "東京", "横浜", "西海", "京都", "浪速"];

let totalGamesPlayed = 0;
const MAX_GAMES = 143;
let teams = [];

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
        
        // 野手16人生成
        for(let i=1; i<=16; i++) {
            let isStamen = i <= 9;
            let pos = ["捕手","一塁手","二塁手","三塁手","遊撃手","左翼手","中堅手","右翼手","一塁手","捕手","内野手","内野手","外野手","外野手","外野手","内野手"][i-1];
            teamObj.batters.push({
                id: i-1,
                name: generateRandomPlayerName(),
                role: isStamen ? `${i}番` : "控え",
                originalPos: pos,
                currentPos: pos,
                bb: isStamen ? [11, 9, 12, 15, 10, 8, 7, 7, 5][i-1] : 7.0,
                so: isStamen ? [14, 16, 15, 20, 18, 22, 23, 25, 30][i-1] : 22.0,
                barrel: isStamen ? [10, 12, 22, 30, 18, 14, 12, 10, 6][i-1] : 8.0, 
                isop: isStamen ? [15, 18, 30, 45, 24, 22, 18, 14, 8][i-1] : 12,    
                uzr: isStamen ? [3, 4, 1.5, 1.0, 3.5, 0, 1, 0.5, 0][i-1] : 0,
                err: 2.0,
                stats: { games: 0, ab: 0, hits: 0, hr: 0, rbi: 0, bb: 0, so: 0 }
            });
        }
        
        // 投手12人生成
        for(let i=1; i<=12; i++) {
            let isStarter = i <= 5;
            let isCloser = i === 12;
            teamObj.pitchers.push({
                id: i-1,
                name: generateRandomPlayerName(),
                role: isCloser ? "守護神" : (isStarter ? "先発" : "リリーフ"),
                currentPos: "投手",
                originalPos: "投手",
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
