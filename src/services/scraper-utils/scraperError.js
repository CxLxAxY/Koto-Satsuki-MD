class ScraperError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ScraperError';
    this.code = code;
  }
}

const publicMessages = {
  INVALID_URL: 'URL tidak valid.',
  INVALID_INPUT: 'Input command tidak valid.',
  PRIVATE_ADDRESS_NOT_ALLOWED: 'URL menuju alamat jaringan yang tidak diizinkan.',
  PRIVATE_HOST_NOT_ALLOWED: 'URL menuju host yang tidak diizinkan.',
  URL_CREDENTIALS_NOT_ALLOWED: 'URL dengan kredensial tidak diizinkan.',
  UNSUPPORTED_PROTOCOL: 'Protokol URL tidak didukung.',
  UNSUPPORTED_PORT: 'Port URL tidak didukung.',
  HOST_LOOKUP_FAILED: 'Host URL tidak dapat diverifikasi dengan aman.',
  UNSUPPORTED_URL: 'URL tersebut tidak didukung oleh provider.',
  SCRAPER_UNAVAILABLE: 'Scraper ini sedang tidak tersedia.',
  UPSTREAM_FAILED: 'Sumber sedang gagal merespons. Silakan coba lagi nanti.',
  TIMEOUT: 'Sumber terlalu lama merespons. Silakan coba lagi nanti.',
  NO_RESULTS: 'Tidak ada hasil yang ditemukan.',
  UNSUPPORTED_CONTENT: 'Konten ini tidak dapat diproses.',
  DOWNLOAD_TOO_LARGE: 'Media melebihi batas ukuran pengiriman WhatsApp.',
  UNSUPPORTED_MEDIA: 'Format media tidak didukung untuk dikirim.',
  DOWNLOAD_FAILED: 'Media tidak dapat diambil dengan aman.',
  RATE_LIMITED: 'Sumber sedang membatasi permintaan. Silakan coba lagi nanti.',
};

const getPublicErrorMessage = (error) =>
  publicMessages[error?.code] ||
  'Permintaan gagal diproses. Silakan coba lagi nanti.';

export { getPublicErrorMessage, ScraperError };
