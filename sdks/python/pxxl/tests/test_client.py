from pathlib import Path
import unittest

from pxxl import PxxlClient, create_project_zip


class PxxlClientTests(unittest.TestCase):
    def test_client_requires_api_key(self):
        with self.assertRaisesRegex(ValueError, "api_key is required"):
            PxxlClient(api_key="")

    def test_create_project_zip_skips_secrets(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "main.py").write_text("print('hello')\n")
            (tmp_path / ".env").write_text("SECRET=1\n")
            archive = create_project_zip(tmp_path)
            self.assertIn(b"main.py", archive)
            self.assertNotIn(b".env", archive)
