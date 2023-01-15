const {initializeApp} = require("firebase-admin/app");
const functions = require("firebase-functions");
const axios = require("axios");
const ical = require("ical-generator");

initializeApp();

const GRAPH_URL = "https://www.volosports.com/graphql";

const getSchedulePayload = (userId) => ({
  operationName: "UserGames",
  variables: {
    input: {
      which: "_id",
      search: userId,
    },
  },
  query: `
    query UserGames($input: UserInfoInput!) {
      getUserByInfo(input: $input) {
        leagues {
          _id
          displayName
          schedule {
            games {
              start_time
              end_time
              field_name
              location {
                name
                formatted_address
              }
              timezone
              teams {
                _id
                name
                color {
                  hex
                }
                players {
                  _id
                }
              }
            }
          }
        }
      }
    }
  `,
});

const getLeagueStandings = (leagueId) => ({
  operationName: "LeagueStandings",
  variables: {
    input: {
      leagueId: leagueId,
    },
  },
  query: `
    query LeagueStandings($input: LeagueStandingsInput!) {
      leagueStandings(input: $input) {
        standings {
          team {
            _id
          }
          WIN
          LOSE
          FORFEIT
          TIE
        }
      }
    }
  `,
});

const getICalForUserId = async (userId) => {
  const response = await axios.post(GRAPH_URL, getSchedulePayload(userId));
  console.log("Game schedule for", userId, response.data);

  const calendar = ical({name: "Volo Games"});

  const teamRecords = {};

  await Promise.all(response.data.data.getUserByInfo.leagues.map(
      async ({_id: leagueId, displayName, schedule}) => {
        const response =
          await axios.post(GRAPH_URL, getLeagueStandings(leagueId));
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

          calendar.createEvent({
            start: new Date(game.start_time),
            end: new Date(game.end_time),
            summary: `${myTeam.name} v. ${otherTeam.name}`,
            description: `${game.field_name}

${myTeam.name} (${myRecordText})
v.
${otherTeam.name} (${otherRecordText})`,
            location:
              `${game.location.name} ${game.location.formatted_address}`,
          });
        }));
      }));

  return calendar;
};

exports.refreshCalendar = functions.https.onRequest(async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    res.status(400).send("Query string missing userId");
    console.log("Missing user id");
    return;
  }

  console.log("Fetching schedule for", userId);

  try {
    const calendar = await getICalForUserId(userId);
    console.log(calendar);
    res.status(200).send(calendar.toString());
  } catch (err) {
    console.log("Error fetching", err);
    res.status(500).send(err);
  }
});
