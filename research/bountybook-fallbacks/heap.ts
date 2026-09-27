export class MinHeap<T> {
  private items: T[] = [];
  constructor(private comparator: (a: T, b: T) => number) {}

  get size(): number { return this.items.length; }
  peek(): T | undefined { return this.items[0]; }

  push(item: T): void {
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.comparator(this.items[i], this.items[p]) >= 0) break;
      [this.items[i], this.items[p]] = [this.items[p], this.items[i]];
      i = p;
    }
  }

  pop(): T | undefined {
    if (!this.items.length) return undefined;
    const min = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length) {
      this.items[0] = last;
      let i = 0;
      while (true) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < this.items.length && this.comparator(this.items[l], this.items[m]) < 0) m = l;
        if (r < this.items.length && this.comparator(this.items[r], this.items[m]) < 0) m = r;
        if (m === i) break;
        [this.items[i], this.items[m]] = [this.items[m], this.items[i]];
        i = m;
      }
    }
    return min;
  }

  toSortedArray(): T[] {
    const copy = new MinHeap<T>(this.comparator);
    copy.items = this.items.slice();
    const out: T[] = [];
    while (copy.size) out.push(copy.pop()!);
    return out;
  }
}
