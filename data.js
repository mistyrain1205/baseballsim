// data.js
const positions = ["捕手", "一塁手", "二塁手", "三塁手", "遊撃手", "左翼手", "中堅手", "右翼手", "投手"];
const teamNames = ["大阪", "東京", "横浜", "西海", "京都", "浪速"];
const conditions = ["絶好調", "好調", "普通", "不調", "絶不調"];

const prefectures = ["北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島", "茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川", "新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜", "静岡", "愛知", "三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山", "鳥取", "島根", "岡山", "広島", "山口", "徳島", "香川", "愛媛", "高知", "福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"];

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
        
        // 野手20人生成
        for(let i=1; i<=20; i++) {
            let isStamen = i <= 9;
            let isFirstTeam = i <= 16;
            let pos = ["捕手","一塁手","二塁手","三塁手","遊撃手","左翼手","中堅手","右翼手","一塁手","捕手","内野手","内野手","外野手","外野手","外野手","内野手","内野手","外野手","捕手","内野手"][i-1];
            
            let graduation = ["高卒", "大卒", "社会人"][Math.floor(Math.random() * 3)];
            let proYears = Math.floor(Math.random() * 12) + 1; 
            let baseAge = graduation === "高卒" ? 18 : (graduation === "大卒" ? 22 : 24);
            let age = baseAge + (proYears - 1);

            teamObj.batters.push({
                id: i-1,
                name: generateRandomPlayerName(),
                role: isStamen ? `${i}番` : (isFirstTeam ? "一軍控え" : "二軍"),
                originalPos: pos,
                currentPos: pos,
                condition: "普通",
                age: age,
                hometown: prefectures[Math.floor(Math.random() * prefectures.length)],
                graduation: graduation,
                proYears: proYears,
                exp: 0, 
                bb: isStamen ? [11, 9, 12, 15, 10, 8, 7, 7, 5][i-1] : 7.0,
                so: isStamen ? [14, 16, 15, 20, 18, 22, 23, 25, 30][i-1] : 22.0,
                barrel: isStamen ? [10, 12, 22, 30, 18, 14, 12, 10, 6][i-1] : 8.0, 
                isop: isStamen ? [15, 18, 30, 45, 24, 22, 18, 14, 8][i-1] : 12,    
                uzr: isStamen ? [3, 4, 1.5, 1.0, 3.5, 0, 1, 0.5, 0][i-1] : 0,
                err: 2.0,
                stats: { games: 0, ab: 0, hits: 0, hr: 0, rbi: 0, bb: 0, so: 0 }
            });
        }
        
        // 投手15人生成
        for(let i=1; i<=15; i++) {
            let isStarter = i <= 5;
            let isCloser = i === 12;
            let isFirstTeam = i <= 12;
            
            let graduation = ["高卒", "大卒", "社会人"][Math.floor(Math.random() * 3)];
            let proYears = Math.floor(Math.random() * 12) + 1;
            let baseAge = graduation === "高卒" ? 18 : (graduation === "大卒" ? 22 : 24);
            let age = baseAge + (proYears - 1);

            teamObj.pitchers.push({
                id: i-1,
                name: generateRandomPlayerName(),
                role: isFirstTeam ? (isCloser ? "守護神" : (isStarter ? "先発" : "リリーフ")) : "二軍リリーフ",
                currentPos: "投手",
                originalPos: "投手",
                condition: "普通",
                age: age,
                hometown: prefectures[Math.floor(Math.random() * prefectures.length)],
                graduation: graduation,
                proYears: proYears,
                exp: 0,
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
