export type NewsItem = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  image?: string;
};

export type MatchItem = {
  slug: string;
  league: string;
  home: string;
  away: string;
  homeScore?: number;
  awayScore?: number;
  status: 'scheduled' | 'live' | 'finished';
  kickoff: string;
};
