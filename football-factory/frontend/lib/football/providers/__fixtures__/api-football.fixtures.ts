// Sanitized API-Football (api-sports) fixtures.
// Real API keys / x-apisports-key headers are NEVER included.

export const AF_LEAGUES_LIST = {
  get: 'leagues',
  results: 2,
  response: [
    {
      league: { id: 39, name: 'Premier League', type: 'League', logo: 'https://example.test/pl.png', country: 'England' },
      country: { name: 'England', code: 'GB', flag: 'https://example.test/gb.png' },
      seasons: [
        { year: 2024, start: '2024-08-09', end: '2025-05-25', current: true, coverage: {} },
        { year: 2023, start: '2023-08-11', end: '2024-05-19', current: false, coverage: {} },
      ],
    },
    {
      league: { id: 78, name: 'Bundesliga', type: 'League', logo: 'https://example.test/bl.png', country: 'Germany' },
      country: { name: 'Germany', code: 'DE', flag: 'https://example.test/de.png' },
      seasons: [
        { year: 2024, start: '2024-08-23', end: '2025-05-17', current: true, coverage: {} },
      ],
    },
  ],
};

export const AF_FIXTURES_LIST = {
  get: 'fixtures',
  results: 2,
  response: [
    {
      fixture: {
        id: 100001,
        referee: null,
        timezone: 'UTC',
        date: '2025-02-01T15:00:00Z',
        timestamp: 1738422000,
        status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
      },
      league: { id: 39, name: 'Premier League', country: 'England', logo: 'https://example.test/pl.png', flag: null, season: 2024, round: 'Regular Season - 23' },
      teams: {
        home: { id: 66, name: 'Manchester United', logo: 'https://example.test/mun.png', winner: true },
        away: { id: 73, name: 'Tottenham Hotspur', logo: 'https://example.test/tot.png', winner: false },
      },
      goals: { home: 2, away: 1 },
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: 2, away: 1 },
        extratime: { home: null, away: null },
        penalty: { home: null, away: null },
      },
    },
    {
      fixture: {
        id: 100002,
        referee: null,
        timezone: 'UTC',
        date: '2025-02-05T20:00:00Z',
        timestamp: 1738584000,
        status: { long: 'Not Started', short: 'NS', elapsed: null },
      },
      league: { id: 39, name: 'Premier League', country: 'England', logo: 'https://example.test/pl.png', flag: null, season: 2024, round: 'Regular Season - 23' },
      teams: {
        home: { id: 64, name: 'Liverpool', logo: 'https://example.test/liv.png', winner: null },
        away: { id: 61, name: 'Chelsea', logo: 'https://example.test/che.png', winner: null },
      },
      goals: { home: null, away: null },
      score: {
        halftime: { home: null, away: null },
        fulltime: { home: null, away: null },
        extratime: { home: null, away: null },
        penalty: { home: null, away: null },
      },
    },
  ],
};

export const AF_STANDINGS = {
  get: 'standings',
  results: 1,
  response: [
    {
      league: { id: 39, name: 'Premier League', country: 'England', logo: 'https://example.test/pl.png', flag: null, season: 2024, standings: [] },
      country: { name: 'England', code: 'GB', flag: 'https://example.test/gb.png' },
      standings: [
        [
          { rank: 1, team: { id: 65, name: 'Manchester City', logo: 'https://example.test/mci.png' }, points: 71, goalsDiff: 48, group: 'Premier League', status: 'same', description: null, all: { played: 30, win: 22, draw: 5, lose: 3, goals: { for: 70, against: 22 } }, home: { played: 15, win: 13, draw: 1, lose: 1, goals: { for: 40, against: 10 } }, away: { played: 15, win: 9, draw: 4, lose: 2, goals: { for: 30, against: 12 } }, form: 'WWDLW' },
          { rank: 2, team: { id: 64, name: 'Liverpool', logo: 'https://example.test/liv.png' }, points: 69, goalsDiff: 40, group: 'Premier League', status: 'same', description: null, all: { played: 30, win: 21, draw: 6, lose: 3, goals: { for: 65, against: 25 } }, home: { played: 15, win: 12, draw: 3, lose: 0, goals: { for: 38, against: 8 } }, away: { played: 15, win: 9, draw: 3, lose: 3, goals: { for: 27, against: 17 } }, form: 'WWDWL' },
        ],
      ],
    },
  ],
};

export const AF_TEAMS_LIST = {
  get: 'teams',
  results: 1,
  response: [
    {
      team: { id: 66, name: 'Manchester United', country: 'England', founded: 1878, logo: 'https://example.test/mun.png', national: false },
      venue: { id: 556, name: 'Old Trafford', city: 'Manchester', capacity: 74810, surface: 'grass', image: 'https://example.test/ot.png' },
    },
  ],
};

export const AF_MALFORMED = { response: 'not an array' };

export const AF_UNKNOWN_COMPETITION = {
  get: 'leagues',
  response: [
    {
      league: { id: 99999, name: 'Hyper League', type: 'League', logo: 'https://example.test/hyper.png', country: 'Atlantis' },
      country: { name: 'Atlantis', code: 'AT', flag: 'https://example.test/at.png' },
      seasons: [],
    },
  ],
};
