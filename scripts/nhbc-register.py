#!/usr/bin/env python3
"""Snapshot every alphabet/digit partition of NHBC's public builder register."""
import datetime, json, re, string, subprocess, time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlencode
ROOT=Path(__file__).resolve().parents[1]
SOURCE='https://www.nhbc.co.uk/homeowners/guidance/check-the-register'
class Config(HTMLParser):
    values={}
    def handle_starttag(self,tag,attrs):
        values=dict(attrs)
        if values.get('id')=='shopConfig': self.values=values

def request(url,signature=None):
    args=['curl','--fail','--silent','--show-error','--max-time','40','--retry','2',url]
    if signature:args+=['-H','X-Signature: '+signature]
    return subprocess.run(args,capture_output=True,text=True,check=True).stdout

def main():
    config=Config();config.feed(request(SOURCE))
    endpoint=config.values['data-shop-apiurl']+'/buildersregister/registrations'
    folder=ROOT/'results/.cache/nhbc-register';folder.mkdir(parents=True,exist_ok=True)
    rows={};queries=[]
    for letter in string.ascii_lowercase+string.digits:
        data=json.loads(request(endpoint+'?'+urlencode({'companyName':letter}),config.values['data-shop-apikey']))
        if not data.get('succeeded') or not isinstance(data.get('data'),list):raise RuntimeError('Register query failed: '+letter)
        for row in data['data']:rows[(row['name'].strip(),row['county'])]=row
        queries.append({'query':letter,'returned':len(data['data'])})
        (folder/'checkpoint.json').write_text(json.dumps({'queries':queries,'builders':list(rows.values())},indent=2))
        print(f'{letter}: {len(data["data"])} rows; {len(rows)} distinct registrations',flush=True)
        time.sleep(.5)
    snapshot={'source':SOURCE,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'coverage':'Public register only; NHBC permits registrants to opt out. Alphabet and digit name searches; deduplicated by name and county.','queries':queries,'builders':sorted(rows.values(),key=lambda r:(r['name'].strip().casefold(),r['county']))}
    output=ROOT/'docs/nhbc-public-register.json';output.write_text(json.dumps(snapshot,indent=2)+'\n')
    print(f'Saved {len(rows)} registrations to {output}',flush=True)
if __name__=='__main__':main()
