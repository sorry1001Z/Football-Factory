import importlib.util, json, pathlib, sys, unittest
from unittest.mock import patch, MagicMock
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("ff90_dispatch",ROOT/"dispatch.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
class DispatchTests(unittest.TestCase):
    def setUp(self):
        self.report={"schema_version":"ff90.seo_intelligence.v1","site":"sc-domain:ff90.online",
                     "production_writes":False,"approval_required":True,"recommendations":[]}
    def test_reject_http(self):
        with self.assertRaises(ValueError): module.dispatch(self.report,"http://ff90.online/wp-json/ff90-seo/v1/proposals","u","p")
    def test_reject_arbitrary_endpoint(self):
        with self.assertRaises(ValueError): module.dispatch(self.report,"https://ff90.online/wp-json/wp/v2/posts","u","p")
    def test_reject_unsafe_report(self):
        self.report["approval_required"]=False
        with self.assertRaises(ValueError): module.dispatch(self.report,"https://ff90.online/wp-json/ff90-seo/v1/proposals","u","p")
    @patch.object(module.urllib.request,"urlopen")
    def test_dispatch_private_inbox(self,mock):
        ctx=MagicMock()
        ctx.__enter__.return_value=MagicMock(read=lambda: b'{"accepted":true,"publication":false}')
        mock.return_value=ctx
        result=module.dispatch(self.report,"https://ff90.online/wp-json/ff90-seo/v1/proposals","u","p")
        self.assertEqual(result["publication"],False)
        self.assertEqual(mock.call_args.args[0].get_method(),"POST")
if __name__=="__main__":unittest.main()
