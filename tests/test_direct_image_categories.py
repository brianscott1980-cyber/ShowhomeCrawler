import importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('direct',Path(__file__).parents[1]/'scripts/direct-image-categories.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class DirectCategories(unittest.TestCase):
 def test_room_labels(self):
  self.assertEqual(m.categories('A generous bedroom has space for a double bed'),{'Bedroom'})
  self.assertEqual(m.categories('The kitchen includes integrated appliances'),{'Kitchen'})
 def test_combined_room_is_ambiguous(self):
  self.assertEqual(m.categories('An open-plan lounge/dining space'),{'Living Room','Dining Room'})
 def test_page_text_does_not_label_image(self):
  p=m.Labels("https://www.example.com/home");p.feed('<h1>Three bedroom home</h1><img src="/garden.jpg" alt="Showhome photograph">')
  self.assertFalse(m.categories(next(iter(p.labels.values())).pop()[1]))
 def test_relative_urls_use_builder_origin(self):
  self.assertEqual(m.source_key('/photo.jpg?w=400','https://www.cala.co.uk/home'),'www.cala.co.uk/photo.jpg')
 def test_query_variants_share_labels(self):
  p=m.Labels("https://www.example.com/home");p.feed('<img data-src="/photo.jpg?w=400" alt="Bathroom"><img src="/photo.jpg?w=800" alt="Bedroom">')
  self.assertEqual(len(p.labels),1)
  self.assertEqual(len(next(iter(p.labels.values()))),2)
if __name__=='__main__':unittest.main()
