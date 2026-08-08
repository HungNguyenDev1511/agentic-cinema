from abc import ABC, abstractmethod

class BaseParser(ABC):

    @abstractmethod
    def parse(self, path: str) -> str:
        pass