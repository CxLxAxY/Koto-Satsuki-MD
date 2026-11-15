import { ScraperError } from '../../../services/scraper-utils/scraperError.js';
import { readResponseBody, requestPublicUrl } from '../../../services/scraper-utils/publicHttp.js';
import { UrlValidationError, parseHttpUrl } from '../../../services/scraper-utils/urlValidator.js';

const maxRedirects = 5;
const maxHtmlBytes = 256 * 1024;
const htmlRedirectPattern =
  /<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"']+)["']/i;

const resolvePublicUrl = async (
  value,
  { lookup, request = requestPublicUrl } = {},
) => {
  const { url: initialUrl } = parseHttpUrl(value);
  let currentUrl = initialUrl;
  const hops = [];

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    let response;
    try {
      ({ response, url: currentUrl } = await request(currentUrl.href, {
        lookup,
        headers: { Accept: 'text/html,application/xhtml+xml,text/plain,*/*;q=0.8' },
      }));
    } catch (error) {
      if (error instanceof UrlValidationError) {
        throw new ScraperError(error.code);
      }
      if (error?.message === 'PUBLIC_REQUEST_TIMEOUT') {
        throw new ScraperError('TIMEOUT');
      }
      throw new ScraperError('UPSTREAM_FAILED');
    }

    hops.push(currentUrl.href);
    const status = response.statusCode || 0;
    const location = response.headers.location;
    if (status >= 300 && status < 400 && location) {
      response.destroy();
      if (redirectCount === maxRedirects) {
        throw new ScraperError('UPSTREAM_FAILED');
      }
      try {
        currentUrl = new URL(location, currentUrl);
      } catch {
        throw new ScraperError('INVALID_URL');
      }
      continue;
    }

    if (status < 200 || status >= 400) {
      response.destroy();
      throw new ScraperError(status === 429 ? 'RATE_LIMITED' : 'UPSTREAM_FAILED');
    }

    const contentType = String(response.headers['content-type'] || '').toLowerCase();
    if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
      let html;
      try {
        html = (await readResponseBody(response, maxHtmlBytes)).toString('utf8');
      } catch {
        throw new ScraperError('UPSTREAM_FAILED');
      }
      const match = html.match(htmlRedirectPattern);
      if (match?.[1]) {
        if (redirectCount === maxRedirects) {
          throw new ScraperError('UPSTREAM_FAILED');
        }
        try {
          currentUrl = new URL(match[1].trim(), currentUrl);
        } catch {
          throw new ScraperError('INVALID_URL');
        }
        continue;
      }
    } else {
      response.destroy();
    }

    return {
      status: true,
      result: {
        title: 'Unshortened URL',
        originalUrl: initialUrl.href,
        destinationUrl: currentUrl.href,
        url: currentUrl.href,
        hops,
      },
    };
  }

  throw new ScraperError('UPSTREAM_FAILED');
};

export { resolvePublicUrl };
