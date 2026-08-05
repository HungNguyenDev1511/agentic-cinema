from pathlib import Path
import fitz  # PyMuPDF


class ScriptParser:

    @staticmethod
    def parse(file_path: str) -> str:

        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(file_path)

        suffix = path.suffix.lower()

        if suffix == ".txt":
            return path.read_text(encoding="utf-8")

        if suffix == ".md":
            return path.read_text(encoding="utf-8")

        if suffix == ".pdf":

            doc = fitz.open(file_path)

            pages = []

            for page in doc:
                pages.append(page.get_text())

            doc.close()

            return "\n".join(pages)

        raise Exception(f"Unsupported file type {suffix}")