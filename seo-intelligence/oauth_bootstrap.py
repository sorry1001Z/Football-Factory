#!/usr/bin/env python3
"""Local desktop OAuth bootstrap for FF90 Search Console.
Never commit client JSON or token files. Runs only on the owner's computer.
"""
import argparse, json, os, pathlib, sys
SCOPE="https://www.googleapis.com/auth/webmasters.readonly"
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--client-json",required=True,help="Local OAuth Desktop client JSON path")
    p.add_argument("--token-file",required=True,help="Local private token destination")
    p.add_argument("--property",default="sc-domain:ff90.online")
    args=p.parse_args()
    client=pathlib.Path(args.client_json).expanduser()
    dest=pathlib.Path(args.token_file).expanduser()
    if not client.is_file(): p.error("Client JSON file not found")
    if client.resolve()==dest.resolve(): p.error("Token file must differ from client JSON")
    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from googleapiclient.discovery import build
    except ImportError:
        p.error("Install: python -m pip install google-auth-oauthlib google-api-python-client google-auth")
    metadata=json.loads(client.read_text(encoding="utf-8"))
    if "installed" not in metadata: p.error("Expected Desktop app OAuth JSON with 'installed' field")
    creds=None
    if dest.exists():
        creds=Credentials.from_authorized_user_file(str(dest),[SCOPE])
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    if not creds or not creds.valid:
        print("A Google consent window will open. Select the Search Console property owner's Google account.")
        creds=InstalledAppFlow.from_client_secrets_file(str(client),[SCOPE]).run_local_server(
            host="127.0.0.1",port=0,open_browser=True)
    service=build("searchconsole","v1",credentials=creds,cache_discovery=False)
    sites=service.sites().list().execute().get("siteEntry",[])
    match=[x for x in sites if x.get("siteUrl")==args.property and x.get("permissionLevel") not in ("siteUnverifiedUser",None)]
    if not match:
        print("BLOCKED: OAuth succeeded but this account does not have verified Search Console access to "+args.property,file=sys.stderr)
        sys.exit(2)
    dest.parent.mkdir(parents=True,exist_ok=True)
    if os.name!="nt": os.chmod(dest.parent,0o700)
    dest.write_text(creds.to_json(),encoding="utf-8")
    if os.name!="nt": os.chmod(dest,0o600)
    print("PASS: verified property access:",args.property)
    print("OAuth token stored locally:",str(dest))
    print("Do not upload or commit this file.")
if __name__=="__main__": main()
