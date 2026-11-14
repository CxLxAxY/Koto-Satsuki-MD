import { ScraperError } from './scraperError.js';
import { UrlValidationError, parseHttpUrl, validatePublicUrl } from './urlValidator.js';

const isAllowedHost = (hostname, hosts) => {
  const normalized = String(hostname || '').toLowerCase().replace(/\.$/u, '');
  return hosts.some((host) => {
    const domain = String(host).toLowerCase().replace(/\.$/u, '');
    return normalized === domain || normalized.endsWith(`.${domain}`);
  });
};

const validateAllowedUrl = async (
  value,
  { hosts, lookup, protocols = ['https:'] } = {},
) => {
  if (!Array.isArray(hosts) || hosts.length === 0) {
    throw new TypeError('An allowlist of hostnames is required.');
  }
  let parsed;
  try {
    parsed = parseHttpUrl(value);
  } catch (error) {
    throw new ScraperError(
      error instanceof UrlValidationError ? error.code : 'INVALID_URL',
    );
  }
  if (!protocols.includes(parsed.url.protocol)) {
    throw new ScraperError('UNSUPPORTED_URL');
  }
  if (!isAllowedHost(parsed.hostname, hosts)) {
    throw new ScraperError('UNSUPPORTED_URL');
  }
  try {
    await validatePublicUrl(parsed.url.href, { lookup });
  } catch (error) {
    throw new ScraperError(
      error instanceof UrlValidationError ? error.code : 'INVALID_URL',
    );
  }
  return parsed.url.href;
};

export { isAllowedHost, validateAllowedUrl };
