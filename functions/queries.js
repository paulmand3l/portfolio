module.exports.getSchedulePayload = (userId) => ({
  operationName: 'UserGames',
  variables: {
    input: {
      which: '_id',
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
                  name
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

module.exports.getLeagueStandingsPayload = (leagueId) => ({
  operationName: 'LeagueStandings',
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

module.exports.getBirthdaysPayload = (userId) => ({
  operationName: 'UserTeamMateBirthdays',
  variables: {},
  query: `
    query UserTeamMateBirthdays {
      currentUserLeagueConnections {
        team {
          players {
            _id
            fullName
            deactivated
            birthday
            age
          }
          name
        }
        league {
          name
          archived
        }
      }
    }
  `,
});
