import importlib.util
import pathlib
import unittest
HERE = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("ff90_seo_engine",HERE/"engine.py")
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)

class EngineTests(unittest.TestCase):
    def test_missing_is_not_zero(self):
        score, signals=engine.score_record({"keyword":"unknown"})
        self.assertIsNone(score)
        self.assertEqual(signals,[])
    def test_existing_page_never_new_draft(self):
        gsc=[{"keyword":"ตารางคะแนนพรีเมียร์ลีก","page":"https://ff90.online/table/","clicks":10,"impressions":2000,"position":9}]
        items=engine.combine(gsc,{},[{"keyword":"ตารางคะแนนพรีเมียร์ลีก","volume":9000,"difficulty":15}],[])
        self.assertEqual(items[0]["recommendation"],"optimize_existing_page")
    def test_cannibalization_priority(self):
        gsc=[{"keyword":"ผลบอลเมื่อคืน","page":"https://ff90.online/1","clicks":2,"impressions":100,"position":8},
             {"keyword":"ผลบอลเมื่อคืน","page":"https://ff90.online/2","clicks":1,"impressions":100,"position":11}]
        items=engine.combine(gsc,{},[],[])
        self.assertEqual(items[0]["recommendation"],"review_cannibalization")
        self.assertEqual(len(items[0]["existing_pages"]),2)
    def test_two_sources_draft(self):
        items=engine.combine([],{"ข่าวฟุตบอล":{"interest":100,"previous_interest":0}},
          [{"keyword":"ข่าวฟุตบอล","volume":30000,"difficulty":10}],[])
        self.assertEqual(items[0]["recommendation"],"propose_new_draft")
    def test_seed_only_does_not_publish(self):
        items=engine.combine([],{},[],["ผลบอลเมื่อคืน"])
        self.assertIsNone(items[0]["score"])
        self.assertEqual(items[0]["recommendation"],"research")
if __name__=="__main__": unittest.main()
