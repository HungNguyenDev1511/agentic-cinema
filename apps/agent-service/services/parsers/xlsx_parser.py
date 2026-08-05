import pandas as pd

from .base import BaseParser


class ExcelParser(BaseParser):

    def parse(self, path: str):

        sheets = pd.read_excel(
            path,
            sheet_name=None
        )

        result = ""

        for name, df in sheets.items():

            result += f"\n\n### Sheet: {name}\n"

            result += df.to_markdown(index=False)

        return result