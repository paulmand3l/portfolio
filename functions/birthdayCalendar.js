const axios = require('axios');
const ical = require('ical-generator');
const {getBirthdaysPayload} = require('./queries');
const {GRAPH_URL} = require('./constants');

module.exports.getBirthdayICalForUserId = async (userId, authToken) => {
  console.log('Fetching birthday calendar for', userId, 'with', authToken);
  if (
    !userId ||
    !authToken ||
    authToken.length < 600 ||
    authToken.indexOf('QmVhcmVyIGV5SmhiR2N') === 0
  ) {
    return ical({name: 'Invalid Calendar'});
  }

  const response = await axios.post(GRAPH_URL, getBirthdaysPayload(userId), {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  console.log('Got birthday schedule for', userId);

  const calendar = ical({name: 'Volo Team Birthdays'});

  if (
    !response.data.data.currentUserLeagueConnections ||
    !response.data.data.currentUserLeagueConnections.length
  ) {
    console.error(
      'User info response missing leagues',
      JSON.stringify(response.data.data)
    );
    throw new Error('User info response missing leagues');
  }

  const players = {};
  const leagues = {};
  response.data.data.currentUserLeagueConnections.forEach(({league, team}) => {
    if (league.stage === 'archived') {
      return;
    }

    if (!team) {
      return;
    }

    console.log(league);

    team.players.forEach(player => {
      players[player._id] = player;
      if (!leagues[player._id]) {
        leagues[player._id] = [];
      }
      leagues[player._id].push(league.name);
    });
  });

  console.log(players, leagues);

  Object.values(players).forEach(player => {
    try {
      let playerLeagues = '';
      leagues[player._id].sort().forEach(name => {
        playerLeagues += `${name}
`;
      });
      const birthday = new Date(`${player.birthday}T12:00`);
      calendar.createEvent({
        summary: `${player.fullName}'s Birthday`,
        description: `Age ${player.age}

${playerLeagues}
`,
        allDay: true,
        start: birthday,
        end: new Date(birthday.getTime() + 1000 * 60 * 60 * 24),
        repeating: {
          freq: 'YEARLY',
          byMonth: [birthday.getMonth() + 1],
          byMonthDay: [birthday.getDate()],
        },
        busystatus: 'FREE',
      });
    } catch (err) {
      console.log('Error creating calendar event');
      console.log(err);
    }
  });

  return calendar;
};
