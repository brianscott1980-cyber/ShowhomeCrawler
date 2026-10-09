#!/usr/bin/env python3
"""Detect the configured home NAS without treating an unmounted directory as storage."""
import argparse,json,os,re,socket,subprocess,sys,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CONFIG=ROOT/'.showhome/storage-config.json';STATUS=ROOT/'.showhome/storage-status.json'
def save(path,value):
 path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp');tmp.write_text(json.dumps(value,indent=2)+'\n');tmp.replace(path)
def mounted_share(output,server,share):
 hosts={server.lower(),server.lower()+'.local'}
 try:hosts.update(address[4][0].lower() for address in socket.getaddrinfo(server+'.local',445))
 except OSError:pass
 for line in output.splitlines():
  match=re.match(r'//([^ ]+) on (.+) \((smbfs|afpfs),',line)
  if not match:continue
  source,mount,protocol=match.groups();host=source.split('@')[-1].split('/')[0].lower();name=source.rsplit('/',1)[-1]
  if name==share and (host in hosts or host.startswith(server.lower()+'._afpovertcp.')):return Path(mount)
 return None

def wifi_name(interface):
 try:
  text=subprocess.run(['/usr/sbin/networksetup','-getairportnetwork',interface],capture_output=True,text=True,timeout=3).stdout.strip()
  match=re.match(r'Current (?:Wi-Fi|AirPort) Network: (.+)',text)
  return match[1] if match and match[1]!='<redacted>' else None
 except (OSError,subprocess.TimeoutExpired):return None

def probe(root,identity):
 marker=json.loads((root/'.showhome-storage.json').read_text())
 if marker.get('id')!=identity:raise ValueError('Storage identity does not match')
 test=root/('.health-'+uuid.uuid4().hex);test.write_text('storage health check');test.unlink()
 return {'available':True,'freeBytes':os.statvfs(root).f_bavail*os.statvfs(root).f_frsize}

def check(config,auto_mount=False):
 ssid=wifi_name(config.get('wifiInterface','en0'))
 status={'mode':'local','nasAvailable':False,'wifiName':ssid,'homeWifi':ssid in config['homeWifi'] if ssid else None,'reason':'NAS not mounted','contentRoot':None,'migrationComplete':config.get('migrationComplete',False),'checkedAt':time.time()}
 if ssid and ssid not in config['homeWifi']:
  status['reason']='Connected Wi-Fi is not a configured home network';return status
 mounts=subprocess.run(['/sbin/mount'],capture_output=True,text=True,timeout=3).stdout
 mount=mounted_share(mounts,config['server'],config['share'])
 if not mount and auto_mount:
  # A .local host is only discovered locally; reuse existing SMB credentials without prompting.
  try:
   with socket.create_connection((config['server']+'.local',445),timeout=1):pass
   target=Path.home()/'Library/Caches/ShowhomeCrawler/mounts'/config['share'];target.mkdir(parents=True,exist_ok=True)
   result=subprocess.run(['/sbin/mount_smbfs','-N',f'//{config["username"]}@{config["server"]}.local/{config["share"]}',str(target)],capture_output=True,text=True,timeout=8)
   if result.returncode:status['reason']='NAS reachable; connect its share in Finder once to save authentication'
   mounts=subprocess.run(['/sbin/mount'],capture_output=True,text=True,timeout=3).stdout
   mount=mounted_share(mounts,config['server'],config['share'])
  except (OSError,subprocess.TimeoutExpired):status['reason']='NAS unreachable; use local catalogue/cache'
 if mount:
  root=mount/config['directory']
  try:
   result=subprocess.run([sys.executable,__file__,'--probe',str(root),'--identity',config['identity']],capture_output=True,text=True,timeout=5)
   if result.returncode:raise ValueError('NAS identity or write check failed')
   health=json.loads(result.stdout)
   status.update(mode='nas-ready',nasAvailable=True,contentRoot=str(root),freeBytes=health['freeBytes'],reason='Verified home NAS share' if ssid else 'Wi-Fi name hidden by macOS; verified home NAS share')
  except (ValueError,OSError,subprocess.TimeoutExpired):status['reason']='Mounted share is unavailable or has the wrong storage identity'
 return status

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--watch',action='store_true');parser.add_argument('--auto-mount',action='store_true');parser.add_argument('--probe');parser.add_argument('--identity');args=parser.parse_args()
 if args.probe:
  try:print(json.dumps(probe(Path(args.probe),args.identity)))
  except Exception:sys.exit(1)
  return
 config=json.loads(CONFIG.read_text())
 while True:
  try:status=check(config,args.auto_mount);save(STATUS,status)
  except Exception as error:status={'mode':'local','nasAvailable':False,'reason':'Storage detection unavailable','checkedAt':time.time()};save(STATUS,status)
  if not args.watch:print(json.dumps(status,indent=2));return
  time.sleep(30)
if __name__=='__main__':main()
