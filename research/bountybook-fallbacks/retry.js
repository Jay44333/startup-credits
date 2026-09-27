function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retry(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 100,
    factor = 2,
    jitter = false,
  } = options;

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;
      let delay = baseDelayMs * Math.pow(factor, attempt - 1);
      if (jitter) delay *= 0.5 + Math.random();
      await sleep(delay);
    }
  }
  throw lastError;
}

module.exports = { retry };
