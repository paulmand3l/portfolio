const axios = require('axios');
const ical = require('ical-generator');
const {getSchedulePayload, getLeagueStandingsPayload} = require('./queries');
const {GRAPH_URL} = require('./constants');
const { jwtDecode } = require("jwt-decode");

module.exports.getICalForUserId = async (userId, authToken) => {
  const {username, email, exp} = jwtDecode(authToken);

  console.log(`Fetching schedule for ${username} ${email} (${userId})`);

  if (exp < Date.now() / 1000) {
    return ical({name: 'Expired Token'});
  }

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
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Authorization: `Bearer ${authToken}`,
    },
  });
  console.log('Got game schedule for', userId);

  const calendar = ical({name: 'Volo Games'});

  const teamRecords = {};

  try {
    JSON.stringify(response.data.data.currentUserLeagueConnections, null, 2);
  } catch (err) {
    console.error(
      'User info response missing leagues',
      JSON.stringify(response.data.data)
    );
    throw new Error('User info response missing leagues');
  }

  const relevantLeagues =
    response.data.data.currentUserLeagueConnections.filter(({league}) => {
      console.log(`League ${league._id} is ${league.stage}`);
      return ['upcoming', 'active'].includes(league.stage);
    });

  await Promise.all(
    relevantLeagues.map(
      async ({league: {_id: leagueId, stage, schedules}, team: myTeam}) => {
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
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
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

        const gameDays = {};

        games.map(game => {
          const gameDay = new Date(game.start_time).toDateString();
          if (!gameDays[gameDay]) {
            gameDays[gameDay] = [];
          }

          game.teams.forEach(team => {
            if (team._id === myTeam._id) {
              team.isMyTeam = true;
              game.isMyGame = true;
            }

            team.name = team.name.trim();

            if (!teamRecords[team._id]) {
              throw new Error(`No record for team ${team.name} (${team._id})`);
            }
            const record = teamRecords[team._id];
            team.record = `${record.win}-${record.lose}-${record.tie}`;

            game[team._id] = team;
          });

          game.address = `${game.location.name}, ${game.location.formatted_address}`;

          game.teamRsvps.forEach(({teamId, totalYesCount}) => {
            if (game[teamId]) {
              game[teamId].rsvps = totalYesCount;
            }
          });

          if (game.teamRsvps.length < 2) {
            console.log('Game missing rsvps', game.teamRsvps);
          }

          if (game.teamRsvps.length > 2) {
            console.log('Found extra rsvps', game.teamRsvps);
          }

          gameDays[gameDay].push(game);
        });

        Object.values(gameDays).forEach(games => {
          const myGames = games.filter(game => game.isMyGame);
          const otherGames = games.filter(game => !game.isMyGame);

          const gameTimes = {};
          otherGames.forEach(otherGame => {
            const timeSlot = otherGame.start_time;
            if (!gameTimes[timeSlot]) {
              gameTimes[timeSlot] = [];
            }
            gameTimes[timeSlot].push(otherGame);
          });

          const otherGameInfo = [];
          Object.keys(gameTimes)
            .sort((t1, t2) => new Date(t1).getTime() - new Date(t2).getTime())
            .forEach(timeSlot => {
              let [hours, minutes] = new Date(timeSlot)
                .toLocaleTimeString('en-US', {timeZone: 'America/Los_Angeles'})
                .split(' ')[0]
                .split(':');
              hours = parseInt(hours);
              if (hours > 12) {
                hours -= 12;
              }
              otherGameInfo.push(`${hours}:${minutes} PT`);
              gameTimes[timeSlot].forEach(game => {
                otherGameInfo.push(
                  game.teams
                    .map(team => `${team.name}(${team.rsvps})`)
                    .join(' v. ')
                );
              });
            });

          if (myGames.length === 0) {
            console.log('BYE WEEK');
            try {
              calendar.createEvent({
                start: new Date(otherGames[0].start_time),
                end: new Date(otherGames[0].end_time),
                summary: 'BYE WEEK',
                description: `Other games:

${otherGameInfo.join('\n')}`,
                location: otherGames[0].address,
              });
            } catch (err) {
              console.log('Error creating calendar event');
              console.log(err);
            }
            return;
          }

          myGames.forEach(game => {
            let myTeam = null;
            let myTeamIndex = null;
            game.teams.forEach((team, i) => {
              if (team.isMyTeam) {
                myTeam = team;
                myTeamIndex = i;
              }
            });

            if (!myTeam) return;

            const otherTeam = game.teams[1 - myTeamIndex];

            // eslint-disable-next-line max-len
            console.log(
              `Making calendar event from ${game.start_time}->${game.end_time}, ${myTeam.name} vs ${otherTeam.name} at ${game.field_name}`
            );

            try {
              calendar.createEvent({
                start: new Date(game.start_time),
                end: new Date(game.end_time),
                summary: `${myTeam.name}(${myTeam.rsvps || 0}) v. ${
                  otherTeam.name
                }(${otherTeam.rsvps || 0})`,
                description: `${game.field_name}

  ${myTeam.name} ${myTeam.record} (${myTeam.color.name})
  v.
  ${otherTeam.name} ${otherTeam.record} (${otherTeam.color.name})

  Other games:

  ${otherGameInfo.join('\n')}`,
                location: game.address,
              });
            } catch (err) {
              console.log('Error creating calendar event');
              console.log(err);
            }
          });
        });
      }
    )
  );

  return calendar;
};
