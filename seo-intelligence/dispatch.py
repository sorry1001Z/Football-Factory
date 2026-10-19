#!/usr/bin/env python3
"""Submit a validated FF90 SEO report to a private WordPress editorial inbox.
Disabled by default; no site content is published.
"""
import argparse, base64, json, os, pathlib, urllib.error, urllib.parse, urllib.request

def dispatch(report, endpoint, username, app_password):
    if report.get("schema_version") != "ff90.seo_intelligence.v1" or report.get("site") != "sc-domain:ff90.online":
        raise ValueError("Wrong report schema/site")
    if report.get("production_writes") is not False or report.get("approval_required") is not True:
        raise ValueError("Unsafe report mode")
    if not isinstance(report.get("recommendations"), list) or len(report["recommendations"]) > 500:
        raise ValueError("Expected at most 500 recommendations")
    url=urllib.parse.urlparse(endpoint)
    if url.scheme != "https" or url.username or url.password or url.fragment:
        raise ValueError("HTTPS endpoint without userinfo/fragment required")
    if url.path.rstrip("/") != "/wp-json/ff90-seo/v1/proposals":
        raise ValueError("Unexpected WordPress endpoint path")
    data=json.dumps(report,ensure_ascii=False).encode("utf-8")
    if len(data)>1024*1024: raise ValueError("Payload too large")
    credential=base64.b64encode((username+":"+app_password).encode()).decode()
    request=urllib.request.Request(endpoint,data=data,method="POST",headers={
        "Authorization":"Basic "+credential,"Content-Type":"application/json","Accept":"application/json",
        "User-Agent":"FF90-SEO-Bridge/1"})
    with urllib.request.urlopen(request,timeout=25) as response:
        return json.load(response)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--report",required=True)
    p.add_argument("--endpoint",default=os.getenv("FF90_SEO_WP_ENDPOINT",""))
    p.add_argument("--send",action="store_true",help="Explicitly enable private inbox writes")
    args=p.parse_args()
    report=json.loads(pathlib.Path(args.report).read_text(encoding="utf-8"))
    if not args.send:
        print(json.dumps({"mode":"dry_run","records":len(report.get("recommendations",[])),
            "note":"No WordPress request sent"},ensure_ascii=False))
        return
    if os.getenv("FF90_SEO_WRITE_ENABLED")!="true":
        p.error("FF90_SEO_WRITE_ENABLED=true required")
    username=os.getenv("FF90_WP_USER","")
    password=os.getenv("FF90_WP_APP_PASSWORD","")
    if not all([args.endpoint,username,password]): p.error("Missing WP endpoint or app credentials")
    print(json.dumps(dispatch(report,args.endpoint,username,password),ensure_ascii=False))
if __name__=="__main__":main()
