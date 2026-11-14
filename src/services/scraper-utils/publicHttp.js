import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { validatePublicUrl } from './urlValidator.js';

const requestPublicUrl = async (
  value,
  { headers = {}, lookup, timeoutMs = 15000, method = 'GET' } = {},
) => {
  const validated = await validatePublicUrl(value, { lookup });
  const address = [...validated.addresses].sort(
    (left, right) => left.family - right.family,
  )[0];
  const url = validated.url;
  const transport = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout;
    const clearRequestTimeout = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
    const finish = (callback, value) => {
      if (settled) {
        return;
      }
      settled = true;
      callback(value);
    };
    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: validated.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          Accept: '*/*',
          'Accept-Encoding': 'identity',
          'User-Agent': 'Koto-Satsuki/1.0',
          ...headers,
        },
        servername: isIP(validated.hostname) ? undefined : validated.hostname,
        lookup: (_hostname, options, callback) => {
          if (options?.all) {
            callback(null, [{ address: address.address, family: address.family }]);
            return;
          }
          callback(null, address.address, address.family);
        },
      },
      (response) => finish(resolve, { response, url, addresses: validated.addresses }),
    );
    timeout = setTimeout(() => {
      request.destroy(new Error('PUBLIC_REQUEST_TIMEOUT'));
    }, timeoutMs);
    timeout.unref?.();
    request.on('error', (error) => {
      clearRequestTimeout();
      finish(reject, error);
    });
    request.on('response', (response) => {
      response.once('end', clearRequestTimeout);
      response.once('close', clearRequestTimeout);
      response.once('error', clearRequestTimeout);
    });
    request.end();
  });
};

const readResponseBody = async (response, maxBytes) => {
  const chunks = [];
  let total = 0;
  for await (const chunk of response) {
    total += chunk.length;
    if (total > maxBytes) {
      response.destroy();
      throw new Error('PUBLIC_RESPONSE_TOO_LARGE');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
};

export { readResponseBody, requestPublicUrl };
