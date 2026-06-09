// data.js
const positions = ["捕手", "一塁手", "二塁手", "三塁手", "遊撃手", "左翼手", "中堅手", "右翼手", "投手"];
const teamNames = ["大阪", "東京", "横浜", "西海", "京都", "浪速"];
const conditions = ["絶好調", "好調", "普通", "不調", "絶不調"];

const prefectures = ["北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島", "茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川", "新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜", "静岡", "愛知", "三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山", "鳥取", "島根", "岡山", "広島", "山口", "徳島", "香川", "愛媛", "高知", "福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"];

let totalGamesPlayed = 0;
const MAX_GAMES = 143;
let teams = [];

function createBlankBatter(isStamen, orderIdx) {
    let graduation = ["高卒", "大卒", "社会人"][Math.floor(Math.random() * 3)];
    let baseAge = graduation === "高卒" ? 18 : (graduation === "大卒" ? 22 : 24);
    let pos = ["捕手","一塁手","二塁手","三塁手","遊撃手","左翼手","中堅手","右翼手","内野手"][Math.floor(Math.random() * 9)];
    
    // 🆕 UZRを初期状態でランダム生成（守備職人は高く、鈍足スラッガーは低く）
    let initialUzr = parseFloat((Math.random() * 20 - 10).toFixed(1)); // -10.0 ～ +10.0

    return {
        name: generateRandomPlayerName(),
        role: isStamen ? orderIdx : -1, 
        originalPos: pos, currentPos: pos, condition: "普通",
        age: baseAge, hometown: prefectures[Math.floor(Math.random() * prefectures.length)],
        graduation: graduation, proYears: 1, exp: 0,
        bb: isStamen ? [11, 9, 12, 15, 10, 8, 7, 7, 5][orderIdx-1] : 7.0,
        so: isStamen ? [14, 16, 15, 20, 18, 22, 23, 25, 30][orderIdx-1] : 22.0,
        barrel: isStamen ? [10, 12, 22, 30, 18, 14, 12, 10, 6][orderIdx-1] : 8.0,
        isop: isStamen ? [15, 18, 30, 45, 24, 22, 18, 14, 8][orderIdx-1] : 12,
        uzr: initialUzr, err: 2.0,
        stats: { games: 0, ab: 0, hits: 0, hr: 0, rbi: 0, bb: 0, so: 0 }
    };
}

function createBlankPitcher(roleType) {
    let graduation = ["高卒", "大卒", "社会人"][Math.floor(Math.random() * 3)];
    let baseAge = graduation === "高卒" ? 18 : (graduation === "大卒" ? 22 : 24);
    
    return {
        name: generateRandomPlayerName(),
        role: roleType, originalPos: "投手", currentPos: "投手", condition: "普通",
        age: baseAge, hometown: prefectures[Math.floor(Math.random() * prefectures.length)],
        graduation: graduation, proYears: 1, exp: 0,
        h9: roleType === "守護神" ? 85 : (roleType === "先発" ? 65 : 68),
        k9: roleType === "守護神" ? 88 : (roleType === "先発" ? 62 : 72),
        bb9: 70, hr9: 55,
        staMax: roleType === "先発" ? 95 : 35,
        staCurrent: roleType === "先発" ? 95 : 35,
        stats: { era: 0, appearances: 0, wins: 0, losses: 0, saves: 0, ipOuts: 0, so: 0, bb: 0, er: 0 }
    };
}

function initializeLeagueData() {
    teams = [];
    for(let t=0; t<6; t++) {
        let teamObj = {
            id: t, name: teamNames[t], wins: 0, losses: 0, draws: 0, rotationIdx: 0, batters: [], pitchers: []
        };
        
        // 野手40人生成 (1~9番打者、10~16番が一軍控え、それ以降は二軍)
        for(let i=1; i<=40; i++) {
            let isStamen = i <= 9;
            let isFirstTeam = i <= 16;
            
            // チーム内で満遍なくポジションが分散するように配置
            let pos = ["捕手","一塁手","二塁手","三塁手","遊撃手","左翼手","中堅手","右翼手","内野手","捕手","内野手","外野手","外野手","捕手","内野手","外野手"][i-1] || ["捕手","一塁手","二塁手","三塁手","遊撃手","左翼手","中堅手","右翼手"][i % 8];
            
            let graduation = ["高卒", "大卒", "社会人"][Math.floor(Math.random() * 3)];
            let proYears = Math.floor(Math.random() * 10) + 1; 
            let baseAge = graduation === "高卒" ? 18 : (graduation === "大卒" ? 22 : 24);
            let age = baseAge + (proYears - 1);

            // 🆕 UZRを初期段階からリアルにばらつかせる (-12.0 ～ +12.0)
            let initialUzr = parseFloat((Math.random() * 24 - 12).toFixed(1));
            // 遊撃手や中堅手など、センターラインの選手は若干守備を上手めに補正
            if (pos === "遊撃手" || pos === "中堅手" || pos === "二塁手") initialUzr += 3.0;

            teamObj.batters.push({
                id: i-1, name: generateRandomPlayerName(),
                role: isStamen ? i : (isFirstTeam ? 0 : -1), 
                originalPos: pos, currentPos: pos, condition: "普通",
                age: age, hometown: prefectures[Math.floor(Math.random() * prefectures.length)],
                graduation: graduation, proYears: proYears, exp: 0,
                bb: isStamen ? [11, 9, 12, 15, 10, 8, 7, 7, 5][i-1] : 7.0,
                so: isStamen ? [14, 16, 15, 20, 18, 22, 23, 25, 30][i-1] : 22.0,
                barrel: isStamen ? [10, 12, 22, 30, 18, 14, 12, 10, 6][i-1] : 8.0, 
                isop: isStamen ? [15, 18, 30, 45, 24, 22, 18, 14, 8][i-1] : 12,    
                uzr: parseFloat(initialUzr.toFixed(1)), err: 2.0,
                stats: { games: 0, ab: 0, hits: 0, hr: 0, rbi: 0, bb: 0, so: 0 }
            });
        }
        
        // 投手30人生成
        for(let i=1; i<=30; i++) {
            let isStarter = i <= 5;
            let isCloser = i === 12;
            let isFirstTeam = i <= 12;
            
            let graduation = ["高卒", "大卒", "社会人"][Math.floor(Math.random() * 3)];
            let proYears = Math.floor(Math.random() * 10) + 1;
            let baseAge = graduation === "高卒" ? 18 : (graduation === "大卒" ? 22 : 24);
            let age = baseAge + (proYears - 1);

            teamObj.pitchers.push({
                id: i-1, name: generateRandomPlayerName(),
                role: isFirstTeam ? (isCloser ? "守護神" : (isStarter ? "先発" : "リリーフ")) : "二軍リリーフ",
                currentPos: "投手", originalPos: "投手", condition: "普通",
                age: age, hometown: prefectures[Math.floor(Math.random() * prefectures.length)],
                graduation: graduation, proYears: proYears, exp: 0,
                h9: isCloser ? 85 : (isStarter ? 60 + i : 65 + (i-5)), 
                k9: isCloser ? 88 : (isStarter ? 65 - i : 70 + (i-5)), 
                bb9: isCloser ? 80 : (isStarter ? 70 : 65),
                hr9: isCloser ? 55 : (isStarter ? 50 : 55), 
                staMax: isStarter ? 95 : 35, staCurrent: isStarter ? 95 : 35,
                stats: { era: 0, appearances: 0, wins: 0, losses: 0, saves: 0, ipOuts: 0, so: 0, bb: 0, er: 0 }
            });
        }
        teams.push(teamObj);
    }
}
