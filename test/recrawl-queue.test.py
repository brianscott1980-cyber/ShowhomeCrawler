import runpy, unittest
from pathlib import Path
module = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'scripts/recrawl-builders.py'))
class QueueTests(unittest.TestCase):
    def test_original_order_and_final_reviews(self):
        order = (Path(__file__).resolve().parents[1] / 'docs/builder-recrawl-order.txt').read_text().splitlines()
        remaining = module['remaining_order'](order, 'barratt')
        self.assertEqual(remaining[0], 'taylor-wimpey')
        self.assertEqual(remaining[-3:], ['bellway', 'cala', 'barratt'])
        self.assertEqual(len(remaining), 37)
    def test_rejects_incomplete_and_capped_collection(self):
        valid = {'status': 'completed_with_gaps', 'images': [{'id': 'a'}], 'metrics': {}}
        module['validate_collection'](valid)
        for bad in [{**valid, 'status': 'running'}, {**valid, 'images': []}, {**valid, 'metrics': {'imageLimitOmissions': 1}}]:
            with self.assertRaises(ValueError): module['validate_collection'](bad)
    def test_audit_preserves_missing_urls_without_assuming_retirement(self):
        old = {'properties': [{'url': 'old'}, {'url': 'shared'}], 'images': [{'id': 'a'}]}
        new = {'properties': [{'url': 'new'}, {'url': 'shared'}], 'images': [{'id': 'b'}], 'errors': [{'stage': 'gallery', 'message': 'source gap'}, {'stage': 'classification'}]}
        audit = module['compare_reports'](old, new)
        self.assertEqual(audit['newPropertyUrls'], ['new'])
        self.assertEqual(audit['missingPreviousPropertyUrls'], ['old'])
        self.assertEqual(audit['newImageIds'], 1)
        self.assertEqual(len(audit['sourceErrors']), 1)
if __name__ == '__main__': unittest.main()
