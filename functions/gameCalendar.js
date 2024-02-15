const axios = require('axios');
const ical = require('ical-generator');
const {getSchedulePayload, getLeagueStandingsPayload} = require('./queries');
const {GRAPH_URL} = require('./constants');

module.exports.getICalForUserId = async (userId, authToken) => {
  console.log('Fetching schedule for', userId);
  if (
    !userId ||
    !authToken ||
    authToken.length < 600 ||
    authToken.indexOf('QmVhcmVyIGV5SmhiR2N') === 0
  ) {
    return ical({name: 'Invalid Calendar'});
  }

  const response = await axios.post(GRAPH_URL, getSchedulePayload(userId), {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  console.log('Got game schedule for', userId);

  const calendar = ical({name: 'Volo Games'});

  const teamRecords = {};

  if (!response.data.data.getUserByInfo.activeLeagues) {
    console.error(
      'User info response missing leagues',
      JSON.stringify(response.data.data)
    );
    throw new Error('User info response missing leagues');
  }

  await Promise.all(
    response.data.data.getUserByInfo.activeLeagues.map(
      async ({_id: leagueId, schedules}) => {
        console.log(
          'Fetching standings for user',
          userId,
          'in league',
          leagueId
        );
        const response = await axios.post(
          GRAPH_URL,
          getLeagueStandingsPayload(leagueId),
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );
        response.data.data.leagueStandings.forEach(standing => {
          teamRecords[standing.teamId] = {
            win: Number(standing.WIN),
            lose: Number(standing.LOSE) + Number(standing.FORFEIT || 0),
            tie: Number(standing.TIE),
          };
        });

        const games = schedules.flatMap(schedule => schedule.games);
        console.log(games);

        await Promise.all(
          games.map(async game => {
            let myTeam = null;
            let myTeamIndex = null;
            game.teams.forEach((team, i) => {
              team.players.forEach(player => {
                if (player._id === userId) {
                  myTeam = team;
                  myTeamIndex = i;
                }
              });

              if (!teamRecords[team._id]) {
                throw new Error(
                  `No record for team ${team.name} (${team._id})`
                );
              }
            });

            const teamRSVPs = {};
            game.teamRsvps.forEach(({teamId, totalYesCount}) => {
              teamRSVPs[teamId] = totalYesCount;
            });

            if (!myTeam) return;

            const otherTeam = game.teams[1 - myTeamIndex];
            const myRecord = teamRecords[myTeam._id];
            const otherRecord = teamRecords[otherTeam._id];
            const myRSVPs = teamRSVPs[myTeam._id];
            const otherRSVPs = teamRSVPs[otherTeam._id];

            const myRecordText = `${myRecord.win}-${myRecord.lose}-${myRecord.tie}`;
            const otherRecordText = `${otherRecord.win}-${otherRecord.lose}-${otherRecord.tie}`;

            // eslint-disable-next-line max-len
            console.log(
              `Making calendar event from ${game.start_time}->${game.end_time}, ${myTeam.name} vs ${otherTeam.name} at ${game.field_name}`
            );
            const address = game.location.formatted_address;

            try {
              calendar.createEvent({
                start: new Date(game.start_time),
                end: new Date(game.end_time),
                summary: `${myTeam.name.trim()}(${myRSVPs}) v. ${otherTeam.name.trim()}(${otherRSVPs})`,
                description: `${game.field_name}

${myTeam.name} ${myRecordText} (${myTeam.color.name})
v.
${otherTeam.name} ${otherRecordText} (${otherTeam.color.name})`,
                location: `${game.location.name}, ${address}`,
              });
            } catch (err) {
              console.log('Error creating calendar event');
              console.log(err);
            }
          })
        );
      }
    )
  );

  return calendar;
};
