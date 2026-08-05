import pandas as pd

from .base import BaseParser


class CsvParser(BaseParser):

    def parse(self, path: str):

        df = pd.read_csv(path)

        return df.to_markdown(index=False)