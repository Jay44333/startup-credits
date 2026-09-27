class RateLimiter {
  constructor({ capacity, refillRate, refillInterval }) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.refillInterval = refillInterval;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  _refill() {
    const now = Date.now();
    const intervals = Math.floor((now - this.lastRefill) / this.refillInterval);
    if (intervals > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + intervals * this.refillRate);
      this.lastRefill += intervals * this.refillInterval;
    }
  }

  tryConsume(n = 1) {
    this._refill();
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }

  available() {
    this._refill();
    return Math.floor(this.tokens);
  }
}

module.exports = { RateLimiter };
