import { ScraperError } from './scraperError.js';

const withTimeout = (operation, timeoutMs) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ScraperError('TIMEOUT')), timeoutMs);
    timer.unref?.();
    Promise.resolve()
      .then(operation)
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });

export { withTimeout };
