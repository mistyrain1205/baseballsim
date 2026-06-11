// data.js をこれに置き換えてください
let teams = [];
let totalGamesPlayed = 0;
let userTeamId = 0;
let currentYear = 1;
const MAX_GAMES = 143;
const teamNames = ["大阪", "東京", "横浜", "西海", "京都", "浪速"];
const prefectures = ["北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島", "茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川", "新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜", "静岡", "愛知", "三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山", "鳥取", "島根", "岡山", "広島", "山口", "徳島", "香川", "愛媛", "高知", "福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"];

function initializeLeagueData() {
    teams = [];
    for(let t=0; t<6; t++) {
        let teamObj = { id: t, name: teamNames[t], wins: 0, losses: 0, draws: 0, rotationIdx: 0, batters: [], pitchers: [] };
        // 野手生成
        for(let i=0; i<40; i++) {
            teamObj.batters.push({ 
                name: generateRandomPlayerName(), role: i<9 ? i+1 : -1, 
                stats: { ab:0, hits:0, hr:0, war:0.0 },
                age: 25, currentPos: "一塁手", condition: "普通" 
            });
        }
        // 投手生成
        for(let i=0; i<30; i++) {
            teamObj.pitchers.push({ 
                name: generateRandomPlayerName(), role: i<5 ? "先発" : "リリーフ", 
                stats: { wins:0, er:0, ipOuts:0, war:0.0 },
                age: 25, condition: "普通" 
            });
        }
        teams.push(teamObj);
    }
}
