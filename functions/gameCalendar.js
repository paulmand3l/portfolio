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

        const gameDays = {};

        games.map(game => {
          const gameDay = new Date(game.start_time).toDateString();
          if (!gameDays[gameDay]) {
            gameDays[gameDay] = [];
          }

          gameDays[gameDay].push(game);
        });

        Object.values(gameDays).forEach(games => {
          games.forEach(game => {
            game.teams.forEach(team => {
              if (team.players.some(player => player._id === userId)) {
                team.isMyTeam = true;
                game.isMyGame = true;
              }

              team.name = team.name.trim();

              if (!teamRecords[team._id]) {
                throw new Error(
                  `No record for team ${team.name} (${team._id})`
                );
              }
              const record = teamRecords[team._id];
              team.record = `${record.win}-${record.lose}-${record.tie}`;

              game[team._id] = team;
            });

            game.address = `${game.location.name}, ${game.location.formatted_address}`;

            game.teamRsvps.forEach(({teamId, totalYesCount}) => {
              game[teamId].rsvps = totalYesCount;
            });
          });

          const game = games.find(game => game.isMyGame);
          const otherGames = games.filter(game => !game.isMyGame);

          console.log('other games today', otherGames);

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

          if (!game) {
            try {
              calendar.createEvent({
                start: new Date(otherGames[0].start_time),
                end: new Date(otherGames[0].end_time),
                summary: 'BYE WEEK',
                description: `Other games:
                
${otherGameInfo.join('\n')}`,
                location: game.address,
              });
            } catch (err) {
              console.log('Error creating calendar event');
              console.log(err);
            }
          }

          let myTeam = null;
          let myTeamIndex = null;
          game.teams.forEach((team, i) => {
            if (team.isMyTeam) {
              myTeam = team;
              myTeamIndex = i;
            }
          });

          const teamRSVPs = {};
          game.teamRsvps.forEach(({teamId, totalYesCount}) => {
            teamRSVPs[teamId] = totalYesCount;
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
              summary: `${myTeam.name}(${myTeam.rsvps}) v. ${otherTeam.name}(${otherTeam.rsvps})`,
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
      }
    )
  );

  return calendar;
};
