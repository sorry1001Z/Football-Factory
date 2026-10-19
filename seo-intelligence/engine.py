#!/usr/bin/env python3
"""FF90 SEO Intelligence v1: read-only source collection and editorial suggestions.
No database writes, publishing, crawling or undocumented Google Trends API access.
Python >=3.10; standard library only.
"""
from __future__ import annotations
import argparse, csv, datetime as dt, json, os, pathlib, re, urllib.parse, urllib.request
from collections import defaultdict

def request_json(url: str, token: str, *, payload=None, timeout=20):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "FF90-SEO-Intelligence/1.0",
    })
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.load(response)

def gsc_queries(site: str, token: str, start: str, end: str):
    url = "https://www.googleapis.com/webmasters/v3/sites/" + urllib.parse.quote(site, safe="") + "/searchAnalytics/query"
    # Search type web; 2D query/page prevents conflating different landing pages.
    body = {"startDate": start, "endDate": end, "dimensions": ["query", "page"],
            "type": "web", "rowLimit": 25000, "dataState": "final"}
    rows = []
    # Search Analytics is bounded/truncated by Google; pagination improves coverage,
    # but low-volume and anonymized queries may still be unavailable.
    for offset in range(0, 100000, 25000):
        body["startRow"] = offset
        data = request_json(url, token, payload=body)
        returned = data.get("rows", [])
        if not returned:
            break
        for row in returned:
            keys = row.get("keys", [])
            if len(keys) < 2:
                continue
            rows.append({"keyword":keys[0], "page":keys[1], "clicks":float(row.get("clicks", 0)),
                         "impressions":float(row.get("impressions", 0)),
                         "ctr":float(row.get("ctr", 0)), "position":float(row.get("position", 0))})
        if len(returned) < 25000:
            break
    return rows

def ahrefs_overview(keywords, token: str, country="th", batch_size=20):
    # The public API documents keywords-explorer/overview; never fetch without an explicit API key.
    results = []
    for n in range(0, len(keywords), batch_size):
        batch = keywords[n:n+batch_size]
        params = urllib.parse.urlencode({"country":country, "keywords": ",".join(batch),
            "select":"keyword,volume,traffic_potential,difficulty"})
        data = request_json("https://api.ahrefs.com/v3/keywords-explorer/overview?"+params, token)
        for entry in data.get("keywords", data.get("rows", [])):
            if isinstance(entry, dict):
                results.append(entry)
    return results

def load_trends_csv(path):
    """Manually exported, approved input. columns: keyword,interest,previous_interest.
    Interest is relative within the same Trends comparison, NOT search volume.
    """
    with open(path, encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    out = {}
    for row in rows:
        key = norm(row.get("keyword", ""))
        if not key:
            continue
        try:
            interest = float(row["interest"])
            prev = float(row.get("previous_interest") or 0)
        except (TypeError, ValueError):
            continue
        if not 0 <= interest <= 100 or not 0 <= prev <= 100:
            continue
        out[key] = {"interest":interest, "previous_interest":prev}
    return out

def norm(text):
    return re.sub(r"\s+", " ", str(text).strip().casefold())

def clamp(value, lo=0., hi=1.):
    return max(lo, min(hi, value))

def score_record(record):
    """Missing signals are excluded from weighting, never treated as genuine zero."""
    weights = {"trend":0.25, "opportunity":0.30, "demand":0.20, "competition":0.15, "performance":0.10}
    signals = {}
    if record.get("trend_interest") is not None:
        interest = record["trend_interest"]/100.
        previous = record.get("trend_previous") or 0
        surge = clamp((record["trend_interest"]-previous)/50.)
        signals["trend"] = clamp(interest*.65 + surge*.35)
    if record.get("impressions") is not None:
        impressions = record["impressions"]
        ctr = record.get("ctr") or 0
        position = record.get("position") or 0
        # High impression + low CTR/positions 4..20 = useful optimization opportunity.
        if impressions > 0:
            pos_factor = 1 if 4 <= position <= 20 else (.3 if position > 20 else .6)
            signals["opportunity"] = clamp(impressions/(impressions+500) * (1-clamp(ctr/.12)) * pos_factor)
            signals["performance"] = clamp((record.get("clicks") or 0)/((record.get("clicks") or 0)+50))
    if record.get("volume") is not None:
        volume = max(0, record["volume"])
        signals["demand"] = clamp(volume/(volume+1500))
    if record.get("difficulty") is not None:
        signals["competition"] = 1-clamp(record["difficulty"]/100)
    active = sum(weights[k] for k in signals)
    value = round(100*sum(signals[k]*weights[k] for k in signals)/active, 1) if active else None
    return value, sorted(signals)

def combine(gsc, trends, ahrefs, seeds):
    grouped = defaultdict(lambda:{"clicks":0.,"impressions":0.,"weighted_position":0., "pages":set()})
    display = {}
    for row in gsc:
        key = norm(row["keyword"])
        if not key: continue
        display.setdefault(key, row["keyword"])
        agg = grouped[key]
        agg["clicks"] += row["clicks"]
        agg["impressions"] += row["impressions"]
        agg["weighted_position"] += row["position"]*row["impressions"]
        agg["pages"].add(row["page"])
    for seed in seeds:
        display.setdefault(norm(seed), seed)
    for key in trends: display.setdefault(key, key)
    ahref_map = {}
    for r in ahrefs:
        key = norm(r.get("keyword", ""))
        if key:
            ahref_map[key] = r
            display.setdefault(key, r["keyword"])
    items = []
    for key, keyword in display.items():
        a, g, t = ahref_map.get(key,{}), grouped.get(key), trends.get(key)
        rec = {"keyword":keyword, "sources":[], "recommendation":"research",
               "score":None, "signals_available":[], "existing_pages":[]}
        if g:
            imp = g["impressions"]
            rec.update(clicks=g["clicks"], impressions=imp,
                ctr=g["clicks"]/imp if imp else 0,
                position=g["weighted_position"]/imp if imp else 0,
                existing_pages=sorted(g["pages"]))
            rec["sources"].append("gsc")
        if t:
            rec.update(trend_interest=t["interest"],trend_previous=t["previous_interest"])
            rec["sources"].append("trends_csv")
        if a:
            for origin, target in [("volume","volume"),("difficulty","difficulty"),("traffic_potential","traffic_potential")]:
                try:
                    if a.get(origin) is not None: rec[target]=float(a[origin])
                except (TypeError, ValueError): pass
            rec["sources"].append("ahrefs")
        rec["score"],rec["signals_available"]=score_record(rec)
        if len(rec["existing_pages"]) > 1:
            rec["recommendation"]="review_cannibalization"
        elif rec["existing_pages"]:
            rec["recommendation"]="optimize_existing_page"
        elif rec["score"] is not None and rec["score"] >= 55 and len(rec["sources"]) >= 2:
            rec["recommendation"]="propose_new_draft"
        else:
            rec["recommendation"]="research"
        items.append(rec)
    return sorted(items,key=lambda r: (r["score"] is None, -(r["score"] or 0),r["keyword"]))

def main():
    p=argparse.ArgumentParser(description="FF90 SEO intelligence, read-only")
    p.add_argument("--site",default="sc-domain:ff90.online")
    p.add_argument("--start",help="YYYY-MM-DD; default last 30 complete days")
    p.add_argument("--end",help="YYYY-MM-DD; default 3 days ago (final GSC data)")
    p.add_argument("--seed-file",help="UTF-8 text file, one target keyword per line")
    p.add_argument("--trends-csv",help="Approved export columns keyword,interest,previous_interest")
    p.add_argument("--gsc-json",help="Offline GSC normalized rows (no token needed)")
    p.add_argument("--ahrefs-json",help="Offline Ahrefs keyword records (no token needed)")
    p.add_argument("--fetch-ahrefs",action="store_true",help="May consume paid API units")
    p.add_argument("--max-ahrefs-keywords",type=int,default=40)
    p.add_argument("--output",default="seo_intelligence_report.json")
    args=p.parse_args()
    end=dt.date.fromisoformat(args.end) if args.end else dt.date.today()-dt.timedelta(days=3)
    start=dt.date.fromisoformat(args.start) if args.start else end-dt.timedelta(days=29)
    if start>end: p.error("--start must not be after --end")
    seeds = pathlib.Path(args.seed_file).read_text(encoding="utf-8").splitlines() if args.seed_file else []
    gsc, ahrefs, errors = [], [], []
    if args.gsc_json: gsc=json.loads(pathlib.Path(args.gsc_json).read_text(encoding="utf-8"))
    elif os.getenv("GSC_ACCESS_TOKEN"):
        try: gsc=gsc_queries(args.site,os.environ["GSC_ACCESS_TOKEN"],str(start),str(end))
        except Exception as e: errors.append("GSC collection failed: "+str(e))
    else: errors.append("GSC_ACCESS_TOKEN missing: GSC skipped")
    trends=load_trends_csv(args.trends_csv) if args.trends_csv else {}
    if not args.trends_csv: errors.append("Google Trends API alpha unavailable: provide --trends-csv manual export")
    if args.ahrefs_json: ahrefs=json.loads(pathlib.Path(args.ahrefs_json).read_text(encoding="utf-8"))
    elif args.fetch_ahrefs:
        if os.getenv("AHREFS_API_TOKEN"):
            keywords=list(dict.fromkeys([norm(s) for s in seeds if norm(s)]+[norm(x["keyword"]) for x in gsc]))[:args.max_ahrefs_keywords]
            try: ahrefs=ahrefs_overview(keywords,os.environ["AHREFS_API_TOKEN"]) if keywords else []
            except Exception as e: errors.append("Ahrefs collection failed: "+str(e))
        else: errors.append("AHREFS_API_TOKEN missing: Ahrefs skipped")
    else: errors.append("Ahrefs paid API fetch disabled by default")
    report={"schema_version":"ff90.seo_intelligence.v1","site":args.site,"period":{"start":str(start),"end":str(end)},
            "generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
            "production_writes":False,"approval_required":True,
            "source_status":{"gsc_rows":len(gsc),"trends_keywords":len(trends),"ahrefs_rows":len(ahrefs)},
            "warnings":errors,"recommendations":combine(gsc,trends,ahrefs,seeds)}
    pathlib.Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"output":args.output,"keywords":len(report["recommendations"]),"warnings":errors},ensure_ascii=False))
if __name__=="__main__": main()
