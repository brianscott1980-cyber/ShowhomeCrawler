#!/usr/bin/env python3
"""Reconcile the public NHBC snapshot with supported crawler brands, retaining every registration."""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ALIASES={
 'avant':['Avant Homes'],'springfield':['Springfield Properties'],'berkeley-group':['Berkeley Homes','Berkeley Group'],
 'hill-group':['Hill Residential','Hill Group'],'gleeson':['Gleeson Homes','Gleeson Developments'],
 'lovell':['Lovell Partnerships','Lovell Homes'],'larkfleet-homes':['Larkfleet','Allison Homes'],
 'ajc-homes':['AJC Homes'],'countryside-homes':['Countryside Properties','Countryside Homes','Countryside Partnerships'],
 'bovis-homes':['Bovis Homes'],'linden-homes':['Linden Homes'],
}
def matches(name,aliases):
    return any(re.search(r'(?<!\w)'+re.escape(alias)+r'(?!\w)',name,re.I) for alias in aliases)
def main():
    snapshot=json.loads((ROOT/'docs/nhbc-public-register.json').read_text())
    registry=re.findall(r"slug:\s*'([^']+)',\s*name:\s*'([^']+)'",(ROOT/'src/adapters/developers.ts').read_text())
    supported=[];matched=set();unverified=[]
    for slug,name in registry:
        aliases=ALIASES.get(slug,[name])
        evidence=[row for row in snapshot['builders'] if matches(row['name'],aliases)]
        if evidence:
            supported.append({'slug':slug,'brand':name,'matchingAliases':aliases,'registrationEvidence':evidence,'status':'adapter_available'})
            matched.update((row['name'].strip(),row['county']) for row in evidence)
        else:unverified.append({'slug':slug,'brand':name,'status':'no_public_register_name_match'})
    pending=[{**row,'status':'website_and_adapter_research_required'} for row in snapshot['builders'] if (row['name'].strip(),row['county']) not in matched]
    plan={'source':snapshot['source'],'retrievedAt':snapshot['retrievedAt'],'publicRegistrationCount':len(snapshot['builders']),'method':'Name-based brand aliases; legal entities are retained separately. Missing public matches are not evidence of unregistered status.','supportedBrands':supported,'unmatchedExistingBrands':unverified,'pendingRegistrations':pending}
    requests_path=ROOT/'docs/builder-crawl-requests.json'
    requests=json.loads(requests_path.read_text()).get('builders',[]) if requests_path.exists() else []
    plan['requestedBrands']=[{**builder,'registrationEvidence':[row for row in snapshot['builders'] if matches(row['name'],[builder['name']])]} for builder in requests]
    (ROOT/'docs/nhbc-builder-crawl-plan.json').write_text(json.dumps(plan,indent=2)+'\n')
    slugs={row['slug'] for row in supported}
    original=(ROOT/'docs/builder-recrawl-order.txt').read_text().splitlines()
    order=[slug for slug in original if slug in slugs]
    additions=[slug for slug,_ in registry if slug in slugs and slug not in original]
    order=order[:-3]+additions+order[-3:]
    (ROOT/'docs/nhbc-builder-crawl-order.txt').write_text('\n'.join(order)+'\n')
    print(json.dumps({'publicRegistrations':len(snapshot['builders']),'supportedBrands':len(supported),'matchedRegistrations':len(matched),'pendingRegistrations':len(pending),'unmatchedExistingBrands':unverified}))
if __name__=='__main__':main()
