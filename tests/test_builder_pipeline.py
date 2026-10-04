import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('pipeline',Path(__file__).parents[1]/'scripts/builder-pipeline.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Scheduling(unittest.TestCase):
 def test_independent_stages_follow_dependencies(self):
  order=['taylor','david','miller'];state={'taylor':{'gallery':{'status':'complete'},'website':{'status':'complete'},'ai':{'status':'running'}}}
  self.assertEqual(m.eligible('gallery',order,state,{'taylor'}),'david')
  self.assertIsNone(m.eligible('website',order,state,{'taylor','david'}))
  state['david']={'gallery':{'status':'complete'}}
  self.assertEqual(m.eligible('website',order,state,{'taylor'}),'david')
  self.assertEqual(m.eligible('gallery',order,state,{'taylor','david'}),'miller')
 def test_failed_dependency_does_not_advance(self):
  self.assertIsNone(m.eligible('ai',['one'],{'one':{'gallery':{'status':'complete'},'website':{'status':'failed'}}},set()))
 def test_completed_stage_not_repeated(self):
  self.assertIsNone(m.eligible('gallery',['one'],{'one':{'gallery':{'status':'complete'}}},set()))
if __name__=='__main__':unittest.main()
