const axios = require('axios');
const ical = require('ical-generator');
const {
  getSchedulePayload,
  getLeagueStandingsPayload,
} = require('./queries');
const {GRAPH_URL} = require('./constants');


module.exports.getICalForUserId = async (userId, authToken) => {
  console.log('Fetching schedule for', userId, 'with', authToken);
  if (
    !userId ||
    !authToken ||
    authToken.length < 600 ||
    authToken.indexOf('QmVhcmVyIGV5SmhiR2N') === 0) {
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

  if (!response.data.data.getUserByInfo.leagues) {
    console.error(
        'User info response missing leagues',
        JSON.stringify(response.data.data));
    throw new Error('User info response missing leagues');
  }

  await Promise.all(response.data.data.getUserByInfo.leagues.map(
      async ({_id: leagueId, displayName, schedule}) => {
        console.log(
            'Fetching standings for user',
            userId,
            'in league',
            leagueId);
        const response =
          await axios.post(GRAPH_URL, getLeagueStandingsPayload(leagueId), {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          });
        response.data.data.leagueStandings.standings.forEach((standing) => {
          teamRecords[standing.team._id] = {
            win: Number(standing.WIN),
            lose: Number(standing.LOSE) + Number(standing.FORFEIT || 0),
            tie: Number(standing.TIE),
          };
        });

        await Promise.all(schedule.games.map(async (game) => {
          let myTeam = null;
          let myTeamIndex = null;
          await Promise.all(game.teams.map(async (team, i) => {
            team.players.forEach((player) => {
              if (player._id === userId) {
                myTeam = team;
                myTeamIndex = i;
              }
            });

            if (!teamRecords[team._id]) {
              throw new Error(`No record for team ${team.name} (${team._id})`);
            }
          }));

          if (!myTeam) return;

          const otherTeam = game.teams[1-myTeamIndex];
          const myRecord = teamRecords[myTeam._id];
          const otherRecord = teamRecords[otherTeam._id];

          const myRecordText =
            `${myRecord.win}-${myRecord.lose}-${myRecord.tie}`;
          const otherRecordText =
            `${otherRecord.win}-${otherRecord.lose}-${otherRecord.tie}`;

          // eslint-disable-next-line max-len
          console.log(`Making calendar event from ${game.start_time}->${game.end_time}, ${myTeam.name} vs ${otherTeam.name} at ${game.field_name}`);
          const address = game.location.formatted_address;

          try {
            calendar.createEvent({
              start: new Date(game.start_time),
              end: new Date(game.end_time),
              summary: `${myTeam.name} v. ${otherTeam.name}`,
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
        }));
      }));

  return calendar;
};
