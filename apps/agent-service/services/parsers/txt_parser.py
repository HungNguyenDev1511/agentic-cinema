from .base import BaseParser

class TxtParser(BaseParser):

    def parse(self, path: str) -> str:
        with open(path, encoding="utf8") as f:
            return f.read()