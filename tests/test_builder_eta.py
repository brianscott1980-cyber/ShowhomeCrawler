import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('progress',Path(__file__).parents[1]/'scripts/builder-progress.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ETA(unittest.TestCase):
 def setUp(self):m.ETA_SAMPLES.clear()
 def test_rate(self):
  r={'galleries':100,'totalGalleries':200,'startedAt':'test'}
  self.assertEqual(m.crawl_eta('t',r,0)['state'],'estimating')
  r['galleries']=110;e=m.crawl_eta('t',r,60)
  self.assertEqual(e['secondsRemaining'],540);self.assertEqual(e['galleriesPerMinute'],10)
 def test_stall(self):
  r={'galleries':100,'totalGalleries':200,'startedAt':'test'}
  m.crawl_eta('t',r,0);self.assertEqual(m.crawl_eta('t',r,180)['state'],'waiting')
 def test_complete(self):
  self.assertEqual(m.crawl_eta('t',{'galleries':200,'totalGalleries':200,'startedAt':'test'},0)['state'],'finishing')
if __name__=='__main__':unittest.main()
