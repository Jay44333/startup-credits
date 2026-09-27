class Trie:
    def __init__(self):
        self.root = {}
        self.word_count = 0

    def insert(self, word: str) -> None:
        node = self.root
        for ch in word:
            node = node.setdefault(ch, {})
        if "_end" not in node:
            node["_end"] = True
            self.word_count += 1

    def search(self, word: str) -> bool:
        node = self.root
        for ch in word:
            if ch not in node:
                return False
            node = node[ch]
        return bool(node.get("_end"))

    def starts_with(self, prefix: str) -> bool:
        if prefix == "":
            return self.word_count > 0
        node = self.root
        for ch in prefix:
            if ch not in node:
                return False
            node = node[ch]
        return True
