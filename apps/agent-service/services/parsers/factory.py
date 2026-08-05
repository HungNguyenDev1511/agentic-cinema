from pathlib import Path

from .txt_parser import TxtParser
from .pdf_parser import PdfParser
from .docx_parser import DocxParser
from .csv_parser import CsvParser
from .xlsx_parser import ExcelParser


class ParserFactory:

    @staticmethod
    def create(path: str):

        ext = Path(path).suffix.lower()

        if ext == ".txt":
            return TxtParser()

        if ext == ".pdf":
            return PdfParser()

        if ext == ".docx":
            return DocxParser()

        if ext == ".csv":
            return CsvParser()

        if ext in [".xlsx", ".xls"]:
            return ExcelParser()

        raise Exception(f"Unsupported file {ext}")