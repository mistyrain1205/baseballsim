let teams = [];
let totalGamesPlayed = 0;
let userTeamId = 0;
const MAX_GAMES = 143;

function initializeLeagueData() {
    teams = [];
    const teamNames = ["大阪", "東京", "横浜", "西海", "京都", "浪速"];
    for(let t=0; t<6; t++) {
        let teamObj = { id: t, name: teamNames[t], wins: 0, losses: 0, batters: [], pitchers: [] };
        for(let i=0; i<9; i++) teamObj.batters.push({ name: generateRandomPlayerName(), role: i+1 });
        teams.push(teamObj);
    }
}
