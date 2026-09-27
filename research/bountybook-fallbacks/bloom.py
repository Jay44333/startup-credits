import hashlib
import math

class BloomFilter:
    def __init__(self, capacity: int, fp_rate: float):
        if capacity <= 0:
            raise ValueError("capacity must be positive")
        if not 0 < fp_rate < 1:
            raise ValueError("fp_rate must be between 0 and 1")
        m = -(capacity * math.log(fp_rate)) / (math.log(2) ** 2)
        self._m = max(1, int(math.ceil(m)))
        k = (self._m / capacity) * math.log(2)
        self._k = max(2, int(round(k)))
        self._bits = bytearray((self._m + 7) // 8)

    @property
    def bit_array_size(self) -> int:
        return self._m

    @property
    def num_hash_functions(self) -> int:
        return self._k

    def _positions(self, item: str):
        data = item.encode("utf-8")
        h1 = int.from_bytes(hashlib.md5(data).digest(), "big")
        h2 = int.from_bytes(hashlib.sha256(data).digest(), "big")
        for i in range(self._k):
            yield (h1 + i * h2) % self._m

    def add(self, item: str) -> None:
        for p in self._positions(item):
            self._bits[p >> 3] |= 1 << (p & 7)

    def contains(self, item: str) -> bool:
        return all(self._bits[p >> 3] & (1 << (p & 7)) for p in self._positions(item))

if __name__ == "__main__":
    bf = BloomFilter(capacity=1000, fp_rate=0.01)
    words = ["apple", "banana", "cherry", "date", "elderberry"]
    for w in words:
        bf.add(w)
    for w in words:
        assert bf.contains(w), f"False negative: {w}"
    assert bf.bit_array_size > 0
    assert bf.num_hash_functions >= 2
    print("All tests passed")
