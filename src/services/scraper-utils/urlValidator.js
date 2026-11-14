import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

class UrlValidationError extends Error {
  constructor(code) {
    super(code);
    this.name = 'UrlValidationError';
    this.code = code;
  }
}

const ipv4ToInteger = (address) =>
  address
    .split('.')
    .reduce((total, octet) => ((total << 8) | Number(octet)) >>> 0, 0);

const ipv4BlockedRanges = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
].map(([network, prefix]) => ({
  network: ipv4ToInteger(network),
  mask: (0xffffffff << (32 - prefix)) >>> 0,
}));

const isPublicIpv4 = (address) => {
  if (isIP(address) !== 4) {
    return false;
  }
  const value = ipv4ToInteger(address);
  return !ipv4BlockedRanges.some(
    ({ network, mask }) => ((value & mask) >>> 0) === network,
  );
};

const parseIpv6Groups = (address) => {
  let value = address.toLowerCase().split('%')[0];
  if (value.includes('.')) {
    const lastColon = value.lastIndexOf(':');
    const ipv4 = value.slice(lastColon + 1);
    if (isIP(ipv4) !== 4) {
      return undefined;
    }
    const octets = ipv4.split('.').map(Number);
    value = `${value.slice(0, lastColon)}:${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }

  const halves = value.split('::');
  if (halves.length > 2) {
    return undefined;
  }
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) {
    return undefined;
  }
  const groups = [...left, ...Array(missing).fill('0'), ...right].map((group) =>
    /^[\da-f]{1,4}$/u.test(group) ? Number.parseInt(group, 16) : Number.NaN,
  );
  return groups.length === 8 && groups.every(Number.isFinite) ? groups : undefined;
};

const isPublicIpv6 = (address) => {
  if (isIP(address) !== 6) {
    return false;
  }
  const groups = parseIpv6Groups(address);
  if (!groups || groups[0] < 0x2000 || groups[0] > 0x3fff) {
    return false;
  }
  if (
    groups[0] === 0x2001 &&
    (groups[1] <= 0x01ff || groups[1] === 0x0db8)
  ) {
    return false;
  }
  return groups[0] !== 0x2002 && groups[0] !== 0x3fff;
};

const isPublicAddress = (address) =>
  isPublicIpv4(address) || isPublicIpv6(address);

const parseHttpUrl = (value) => {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    throw new UrlValidationError('INVALID_URL');
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new UrlValidationError('INVALID_URL');
  }

  const hostname = url.hostname.replace(/^\[|\]$/gu, '').replace(/\.$/u, '');
  const normalizedHost = hostname.toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new UrlValidationError('UNSUPPORTED_PROTOCOL');
  }
  if (url.username || url.password) {
    throw new UrlValidationError('URL_CREDENTIALS_NOT_ALLOWED');
  }
  if (url.port && !['80', '443'].includes(url.port)) {
    throw new UrlValidationError('UNSUPPORTED_PORT');
  }
  if (
    !normalizedHost ||
    normalizedHost === 'localhost' ||
    /\.(localhost|local|internal|test|invalid|example)$/u.test(normalizedHost)
  ) {
    throw new UrlValidationError('PRIVATE_HOST_NOT_ALLOWED');
  }

  url.hash = '';
  return { url, hostname: normalizedHost };
};

const validatePublicUrl = async (value, { lookup = dnsLookup } = {}) => {
  const parsed = parseHttpUrl(value);
  let addresses;
  if (isIP(parsed.hostname)) {
    addresses = [{ address: parsed.hostname }];
  } else {
    try {
      addresses = await lookup(parsed.hostname, { all: true, verbatim: true });
    } catch {
      throw new UrlValidationError('HOST_LOOKUP_FAILED');
    }
  }

  if (
    !Array.isArray(addresses) ||
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicAddress(address))
  ) {
    throw new UrlValidationError('PRIVATE_ADDRESS_NOT_ALLOWED');
  }

  return { ...parsed, addresses };
};

export {
  UrlValidationError,
  isPublicAddress,
  parseHttpUrl,
  validatePublicUrl,
};
