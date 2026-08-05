import fitz

from .base import BaseParser


class PdfParser(BaseParser):

    def parse(self, path: str) -> str:

        doc = fitz.open(path)

        text = ""

        for page in doc:
            text += page.get_text()

        return text