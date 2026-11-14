import { createReadStream } from 'node:fs';
import { DownloadManager } from '../../services/scraper-utils/downloadManager.js';
import { ScraperError } from '../../services/scraper-utils/scraperError.js';
import { formatBytes, sendReply } from '../../utils/formatter.js';
import { buildNewsletterContext } from '../../utils/newsletterContext.js';

const downloadManager = new DownloadManager({
  maxBytes: 15 * 1024 * 1024,
  maxConcurrent: 2,
  maxQueue: 8,
  maxRedirects: 3,
  timeoutMs: 30000,
});
const maxMediaPerCommand = 5;

const cleanLabel = (value, fallback = 'Tidak tersedia') =>
  typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/gu, ' ').trim().slice(0, 180) || fallback
    : fallback;

const getPage = (args) => {
  const flagIndex = args.findIndex((value) => /^--page=\d+$/u.test(value));
  if (flagIndex === -1) {
    return { args, page: 1 };
  }
  const page = Number(args[flagIndex].slice('--page='.length));
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new ScraperError('INVALID_INPUT');
  }
  return {
    args: args.filter((_, index) => index !== flagIndex),
    page,
  };
};

const renderPage = (items, page, pageSize = 5) => {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  if (page > totalPages) {
    throw new ScraperError('NO_RESULTS');
  }
  return {
    totalPages,
    items: items.slice((page - 1) * pageSize, page * pageSize),
  };
};

const makeMediaPayload = (file, caption) => {
  const stream = createReadStream(file.path);
  const contextInfo = buildNewsletterContext();
  if (file.mediaKind === 'image') {
    return { image: stream, mimetype: file.mimeType, caption, contextInfo };
  }
  if (file.mediaKind === 'video') {
    return { video: stream, mimetype: file.mimeType, caption, contextInfo };
  }
  if (file.mediaKind === 'audio') {
    return { audio: stream, mimetype: file.mimeType, ptt: false, caption, contextInfo };
  }
  return {
    document: stream,
    mimetype: file.mimeType,
    fileName: file.fileName,
    caption,
    contextInfo,
  };
};

const formatDownloadCaption = (result, platform, source, item, index, total) =>
  [
    index === 1 ? 'DOWNLOAD COMPLETED' : `DOWNLOAD COMPLETED (${index}/${total})`,
    '',
    `Title: ${cleanLabel(item.title || result.title)}`,
    `Platform: ${platform}`,
    `Type: ${cleanLabel(item.type || result.type)}`,
    `Quality: ${cleanLabel(item.quality)}`,
    `Source: ${source}`,
  ].join('\n');

const executeDownload = async ({ platform, scrape, args, context, format }) => {
  if (args.length === 0 || !args[0]) {
    throw new ScraperError('INVALID_INPUT');
  }
  if (typeof scrape !== 'function') throw new ScraperError('SCRAPER_UNAVAILABLE');
  const result = await scrape(args[0]);
  const selected = result.downloads.slice(0, maxMediaPerCommand);
  const chatId = context.message?.key?.remoteJid;
  for (let index = 0; index < selected.length; index += 1) {
    const item = selected[index];
    try {
      await downloadManager.withDownloadedFile(
        item.url,
        {
          expectedType: item.type || result.type,
          fileName: item.title || result.title,
        },
        async (file) =>
          context.socket.sendMessage(
            chatId,
            makeMediaPayload(
              file,
              formatDownloadCaption(
                result.result,
                platform,
                result.method,
                item,
                index + 1,
                selected.length,
              ),
            ),
          ),
      );
    } catch (error) {
      if (error?.code === 'DOWNLOAD_TOO_LARGE') {
        await sendReply(
          context,
          `Media terlalu besar untuk dikirim.\nPlatform: ${platform}`,
        );
        return { status: false, code: error.code };
      }
      throw error;
    }
  }
  if (result.downloads.length > selected.length) {
    await sendReply(
      context,
      `${selected.length} media dikirim. ${result.downloads.length - selected.length} item sisanya dilewati karena batas pengiriman.`,
    );
  }
  return { status: true, source: result.method, sent: selected.length, format };
};

const executeYoutubePlaylist = async ({ scraper, args, context }) => {
  const { args: filteredArgs, page } = getPage(args);
  if (!filteredArgs[0]) {
    throw new ScraperError('INVALID_INPUT');
  }
  if (typeof scraper !== 'function') throw new ScraperError('SCRAPER_UNAVAILABLE');
  const result = await scraper(filteredArgs[0]);
  const pageResult = renderPage(result.items, page);
  const lines = [
    'YOUTUBE PLAYLIST',
    `Title: ${cleanLabel(result.title)}`,
    `Page: ${page}/${pageResult.totalPages}`,
    '',
    ...pageResult.items.map(
      (item, index) =>
        `${(page - 1) * 5 + index + 1}. ${cleanLabel(item.title)}\n   URL: ${cleanLabel(item.url)}`,
    ),
  ];
  await sendReply(context, lines.join('\n'));
  return { status: true, count: result.items.length, page };
};

const executeResolver = async ({ provider, scraper, args, context }) => {
  if (!args[0]) {
    throw new ScraperError('INVALID_INPUT');
  }
  if (typeof scraper !== 'function') throw new ScraperError('SCRAPER_UNAVAILABLE');
  const result = await scraper(args[0]);
  const lines = [
    'RESOLVER COMPLETED',
    '',
    `Original URL: ${cleanLabel(result.originalUrl)}`,
    `Destination URL: ${cleanLabel(
      result.resolvedUrl ||
        result.destinationUrl ||
        result.result?.destinationUrl ||
        result.result?.url,
    )}`,
  ];
  if (result.fileName) lines.push(`File Name: ${cleanLabel(result.fileName)}`);
  if (Number.isFinite(result.fileSize)) {
    lines.push(`File Size: ${formatBytes(result.fileSize)}`);
  } else if (typeof result.fileSize === 'string' && result.fileSize.trim()) {
    lines.push(`File Size: ${cleanLabel(result.fileSize)}`);
  }
  lines.push(`Source: ${provider}`);
  await sendReply(context, lines.join('\n'));
  return { status: true, provider };
};

const executeSearch = async ({ title, query, items, page, context }) => {
  const pageResult = renderPage(items, page);
  const lines = [
    `${title} SEARCH`,
    '',
    `Keyword: ${cleanLabel(query)}`,
    `Page: ${page}/${pageResult.totalPages}`,
    '',
    ...pageResult.items.map(
      (item, index) =>
        `${(page - 1) * 5 + index + 1}. ${cleanLabel(item.title)}\n   Provider: ${item.provider}\n   URL: ${cleanLabel(item.url)}`,
    ),
  ];
  await sendReply(context, lines.join('\n'));
  return { status: true, count: items.length, page };
};

const executeList = async ({ title, provider, sourceUrl, items, page, context, itemLabel }) => {
  const pageResult = renderPage(items, page);
  const lines = [
    `${title}`,
    `Provider: ${provider}`,
    `Source: ${cleanLabel(sourceUrl)}`,
    `Page: ${page}/${pageResult.totalPages}`,
    '',
    ...pageResult.items.map(
      (item, index) =>
        `${(page - 1) * 5 + index + 1}. ${cleanLabel(item.title)}\n   URL: ${cleanLabel(item.url)}`,
    ),
    '',
    `${itemLabel}: ${items.length}`,
  ];
  await sendReply(context, lines.join('\n'));
  return { status: true, count: items.length, page };
};

const executeInfo = async ({ title, provider, sourceUrl, data, context }) => {
  const lines = [title, '', `Provider: ${provider}`];
  if (data.title) lines.push(`Title: ${cleanLabel(data.title)}`);
  if (data.author) lines.push(`Author: ${cleanLabel(data.author)}`);
  if (data.type) lines.push(`Type: ${cleanLabel(data.type)}`);
  lines.push(`Source: ${cleanLabel(sourceUrl)}`);
  lines.push('', 'Hanya metadata dan halaman sumber yang ditampilkan; stream, torrent, dan gambar chapter tidak dikirim.');
  await sendReply(context, lines.join('\n'));
  return { status: true, provider };
};

export {
  executeDownload,
  executeInfo,
  executeList,
  executeResolver,
  executeSearch,
  executeYoutubePlaylist,
  getPage,
};
