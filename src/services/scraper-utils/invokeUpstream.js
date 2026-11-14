import logger from '../../utils/logger.js';
import { ConcurrencyLimiter } from './concurrencyLimiter.js';
import { ScraperError } from './scraperError.js';
import { withTimeout } from './withTimeout.js';

const upstreamLimiter = new ConcurrencyLimiter({ maxConcurrent: 3, maxQueue: 12 });

const classifyFailure = (response) => {
  const message = typeof response?.message === 'string' ? response.message : '';
  if (/\b429\b|rate[\s-]?limit|too many requests/iu.test(message)) {
    return 'RATE_LIMITED';
  }
  if (/timed?\s*out|timeout|etimedout/iu.test(message)) {
    return 'TIMEOUT';
  }
  return 'UPSTREAM_FAILED';
};

const invokeUpstream = async ({
  provider,
  methodName,
  method,
  args,
  timeoutMs = 25000,
}) => {
  if (typeof method !== 'function') {
    throw new ScraperError('SCRAPER_UNAVAILABLE');
  }
  const startedAt = performance.now();
  const label = `[SCRAPER:${provider.toUpperCase()}]`;
  logger.media(`${label} Starting method=${methodName}`);
  try {
    const responsePromise = upstreamLimiter.run(() => method(...args));
    const response = await withTimeout(() => responsePromise, timeoutMs);
    if (!response || typeof response !== 'object' || response.status !== true) {
      throw new ScraperError(classifyFailure(response));
    }
    logger.media(
      `${label} Success method=${methodName} duration_ms=${Math.round(performance.now() - startedAt)}`,
    );
    return response;
  } catch (error) {
    const code =
      error instanceof ScraperError
        ? error.code
        : error?.response?.status === 429
          ? 'RATE_LIMITED'
          : ['ECONNABORTED', 'ETIMEDOUT', 'ERR_SOCKET_TIMEOUT'].includes(error?.code)
            ? 'TIMEOUT'
            : error?.message === 'CONCURRENCY_LIMIT_REACHED'
              ? 'RATE_LIMITED'
              : 'UPSTREAM_FAILED';
    logger.warning(
      `${label} Failed method=${methodName} duration_ms=${Math.round(performance.now() - startedAt)} code=${code}`,
    );
    throw new ScraperError(code);
  }
};

export { invokeUpstream };
