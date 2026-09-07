// Sanitized football-data.org fixtures.
// Real API keys / Authorization headers are NEVER included.
// Numeric ids and dates are illustrative and may differ from real responses.

export const FD_COMPETITIONS_LIST = {
  count: 2,
  competitions: [
    {
      id: 2021,
      name: 'Premier League',
      code: 'PL',
      type: 'LEAGUE',
      emblem: 'https://example.test/pl.png',
      area: { id: 2072, name: 'England', code: 'ENG', flag: 'https://example.test/eng.png' },
      currentSeason: { id: 1561, startDate: '2024-08-09', endDate: '2025-05-25', currentMatchday: 10 },
      seasons: [
        { id: 1561, startDate: '2024-08-09', endDate: '2025-05-25', currentMatchday: 10 },
      ],
    },
    {
      id: 2002,
      name: 'Bundesliga',
      code: 'BL1',
      type: 'LEAGUE',
      emblem: 'https://example.test/bl1.png',
      area: { id: 2088, name: 'Germany', code: 'GER', flag: 'https://example.test/ger.png' },
      currentSeason: { id: 1730, startDate: '2024-08-23', endDate: '2025-05-17', currentMatchday: 8 },
      seasons: [],
    },
  ],
};

export const FD_MATCHES_LIST = {
  count: 3,
  matches: [
    {
      id: 1,
      utcDate: '2025-02-01T15:00:00Z',
      status: 'FINISHED',
      matchday: 23,
      homeTeam: { id: 66, name: 'Manchester United' },
      awayTeam: { id: 73, name: 'Tottenham Hotspur' },
      score: {
        winner: 'HOME_TEAM',
        duration: 'REGULAR',
        fullTime: { home: 2, away: 1 },
        halfTime: { home: 1, away: 0 },
      },
      competition: { id: 2021, name: 'Premier League', code: 'PL' },
    },
    {
      id: 2,
      utcDate: '2025-02-05T20:00:00Z',
      status: 'TIMED',
      matchday: 23,
      homeTeam: { id: 64, name: 'Liverpool' },
      awayTeam: { id: 61, name: 'Chelsea' },
      score: { duration: 'REGULAR' },
      competition: { id: 2021, name: 'Premier League', code: 'PL' },
    },
    {
      id: 3,
      // unknown status string to exercise the unknown → canonical mapping
      utcDate: '2025-03-15T16:30:00Z',
      status: 'WHATEVER_NEW_STATE',
      matchday: 30,
      homeTeam: { id: 65, name: 'Manchester City' },
      awayTeam: { id: 68, name: 'Arsenal' },
      score: { duration: 'REGULAR' },
      competition: { id: 2021, name: 'Premier League', code: 'PL' },
    },
  ],
};

export const FD_STANDINGS = {
  id: 2021,
  standings: [
    {
      stage: 'REGULAR_SEASON',
      type: 'TOTAL',
      group: null,
      table: [
        {
          position: 1,
          team: { id: 65, name: 'Manchester City' },
          playedGames: 30,
          won: 22,
          draw: 5,
          lost: 3,
          goalsFor: 70,
          goalsAgainst: 22,
          goalDifference: 48,
          points: 71,
          form: 'WWDLW',
        },
        {
          position: 2,
          team: { id: 64, name: 'Liverpool' },
          playedGames: 30,
          won: 21,
          draw: 6,
          lost: 3,
          goalsFor: 65,
          goalsAgainst: 25,
          goalDifference: 40,
          points: 69,
          form: 'WWDWL',
        },
      ],
    },
  ],
};

export const FD_TEAMS_LIST = {
  count: 2,
  teams: [
    {
      id: 66,
      name: 'Manchester United',
      shortName: 'Man United',
      tla: 'MUN',
      area: { id: 2072, name: 'England', code: 'ENG' },
      crest: 'https://example.test/mun.png',
    },
    {
      id: 73,
      name: 'Tottenham Hotspur',
      shortName: 'Tottenham',
      tla: 'TOT',
      area: { id: 2072, name: 'England', code: 'ENG' },
      crest: 'https://example.test/tot.png',
    },
  ],
};

export const FD_MALFORMED = {
  // intentionally broken: missing competitions array
  count: 0,
};

export const FD_UNKNOWN_COMPETITION = {
  count: 1,
  competitions: [
    {
      id: 9999,
      name: 'Hyper League',
      code: 'HYPER', // not in our registry
      type: 'LEAGUE',
      area: { id: 1, name: 'Atlantis', code: 'ATL' },
    },
  ],
};

export const FD_INVALID_PAYLOAD = '{not valid json';
