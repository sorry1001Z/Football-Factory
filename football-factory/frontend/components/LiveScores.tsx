import Link from 'next/link';
import { mockMatches } from '@/lib/mock-data';

export function LiveScores() {
  return (
    <section className="scorePanel">
      <div className="sectionTitleRow">
        <h2>สกอร์ & โปรแกรมล่าสุด</h2>
        <span className="livePill">● LIVE</span>
      </div>
      <div className="scoreList">
        {mockMatches.map((match) => (
          <Link className="scoreCard" href={`/match/${match.slug}`} key={match.slug}>
            <div className="scoreMeta"><span>{match.league}</span><span>{match.kickoff}</span></div>
            <div className="scoreTeams"><strong>{match.home}</strong><b>{match.homeScore ?? '-'}</b></div>
            <div className="scoreTeams"><strong>{match.away}</strong><b>{match.awayScore ?? '-'}</b></div>
          </Link>
        ))}
      </div>
    </section>
  );
}
