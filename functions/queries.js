module.exports.getSchedulePayload = () => ({
  operationName: 'UserGames',
  variables: {},
  query: `
    query UserGames {
      currentUserLeagueConnections {
        league {
          _id
          stage
          displayName
          schedules {
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
              }
              teamRsvps {
                teamId
                totalYesCount
              }
            }
          }
        }
        team {
          _id
        }
      }
    }
  `,
});

module.exports.getLeagueStandingsPayload = leagueId => ({
  operationName: 'LeagueStandings',
  variables: {
    input: {
      leagueId: leagueId,
    },
  },
  query: `
    query LeagueStandings($input: LeagueStandingsInput!) {
      leagueStandings(input: $input) {
        teamId
        WIN
        LOSE
        FORFEIT
        TIE
      }
    }
  `,
});

module.exports.getBirthdaysPayload = () => ({
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
          stage
        }
      }
    }
  `,
});
