class ConcurrencyLimiter {
  constructor({ maxConcurrent = 2, maxQueue = 10 } = {}) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new TypeError('maxConcurrent must be a positive integer.');
    }
    if (!Number.isInteger(maxQueue) || maxQueue < 0) {
      throw new TypeError('maxQueue must be a non-negative integer.');
    }
    this.maxConcurrent = maxConcurrent;
    this.maxQueue = maxQueue;
    this.active = 0;
    this.queue = [];
  }

  async run(operation) {
    if (this.active >= this.maxConcurrent) {
      if (this.queue.length >= this.maxQueue) {
        throw new Error('CONCURRENCY_LIMIT_REACHED');
      }
      await new Promise((resolve) => this.queue.push(resolve));
    } else {
      this.active += 1;
    }
    try {
      return await operation();
    } finally {
      const next = this.queue.shift();
      if (next) {
        next();
      } else {
        this.active -= 1;
      }
    }
  }
}

export { ConcurrencyLimiter };
