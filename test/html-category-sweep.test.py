import importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('sweep',Path(__file__).resolve().parents[1]/'scripts/html-category-sweep.py');sweep=importlib.util.module_from_spec(spec);spec.loader.exec_module(sweep)
class SweepTests(unittest.TestCase):
 def check(self,alts):
  page='https://example.org/home';parser=sweep.GalleryLabels(page)
  parser.feed(''.join(f'<img src="/{n}.jpg" alt="{alt}">' for n,alt in enumerate(alts)))
  return sweep.evaluate([{'sourceUrl':f'https://example.org/{n}.jpg'} for n in range(len(alts))],parser.labels,page)
 def test_specific_figure_caption(self):
  parser=sweep.GalleryLabels('https://example.org/home');parser.feed('<figure><img src="/1.jpg"><figcaption>Kitchen</figcaption></figure>');self.assertIn(('caption','Kitchen'),parser.labels['example.org/1.jpg'])
 def test_shared_caption_not_assigned(self):
  parser=sweep.GalleryLabels('https://example.org/home');parser.feed('<figure><img src="/1.jpg"><img src="/2.jpg"><figcaption>Kitchen</figcaption></figure>');self.assertEqual(parser.labels['example.org/1.jpg'],set())
 def test_complete_gallery(self):self.assertTrue(self.check(['Kitchen','Bedroom','Lounge'])['compatible'])
 def test_missing_label_keeps_denominator(self):
  result=self.check(['Kitchen','Bedroom','']);self.assertEqual(result['images'],3);self.assertFalse(result['compatible'])
 def test_ambiguous_open_plan_needs_review(self):self.assertFalse(self.check(['Kitchen dining room','Bedroom','Lounge'])['compatible'])
 def test_generic_house_names_not_categories(self):self.assertFalse(self.check(['The Oak','Showhome','Gallery'])['compatible'])
if __name__=='__main__':unittest.main()
