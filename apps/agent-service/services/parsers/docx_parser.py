from docx import Document

from .base import BaseParser


class DocxParser(BaseParser):

    def parse(self, path: str):

        doc = Document(path)

        return "\n".join(
            p.text
            for p in doc.paragraphs
        )