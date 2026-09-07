// FootballDataProvider — re-export from the new client module.
// Kept as a thin re-export so existing imports `import { FootballDataProvider }`
// from `../providers/football-data` keep working.

export { FootballDataProvider, FootballDataClient } from './football-data.client';
