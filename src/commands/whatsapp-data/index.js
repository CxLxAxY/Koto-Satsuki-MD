import config from '../../config/config.js';
import { getGroupContext } from '../group/helpers.js';
import { registerCommand } from '../../handlers/commandHandler.js';
import { memberScraper, messageScraper } from '../../scrapers/whatsapp/index.js';
import { sendReply } from '../../utils/formatter.js';
import { isGroupJid } from '../../utils/groupPermissions.js';

const reply = (context, text) =>
  sendReply({ message: context.message, socket: context.socket }, text);

const USER_JID_PATTERN = /^[^@\s]{1,128}@(s\.whatsapp\.net|lid)$/u;
const getChatScope = (context) => context.message?.key?.remoteJid;
const getIdentity = (context) => {
  const key = context.message?.key || {};
  const candidates = [
    context.senderInfo?.senderJid,
    key.participant,
    key.participantPn,
    key.participantLid,
    key.senderPn,
    key.senderLid,
  ];
  if (!isGroupJid(getChatScope(context))) {
    candidates.push(getChatScope(context));
  }
  return candidates.find(
    (candidate) =>
      typeof candidate === 'string' && USER_JID_PATTERN.test(candidate),
  );
};

const getPrivateIdentity = async (context) => {
  if (isGroupJid(getChatScope(context))) {
    await reply(context, 'Gunakan perintah ini di chat pribadi agar arsip Anda tidak ditampilkan di grup.');
    return undefined;
  }
  const identity = getIdentity(context);
  if (!identity) {
    await reply(context, 'Identitas pengirim tidak dapat diverifikasi.');
    return undefined;
  }
  return identity;
};

const consent = {
  name: 'consent',
  aliases: [],
  description: 'Menjelaskan data yang dapat diarsipkan dan cara memberi persetujuan.',
  category: 'WhatsApp Data',
  usage: 'consent',
  redactSender: true,
  execute: async (context) => {
    const identity = getIdentity(context);
    const scope = getChatScope(context);
    const enabled = config.whatsappData.collectionEnabled;
    const result =
      enabled && identity && scope
        ? await messageScraper.getConsent({ identity, scope })
        : undefined;
    const consented = result?.success && result.data.consented;
    return reply(
      context,
      [
        `Pengumpulan data: ${enabled ? 'tersedia' : 'nonaktif oleh konfigurasi bot'}.`,
        'Jika diaktifkan, hanya teks biasa yang Anda kirim setelah persetujuan, ID pesan dalam bentuk sidik-jari, waktu, dan cakupan chat yang disimpan.',
        'Media, View Once, pesan pengguna lain, dan isi command tidak diarsipkan.',
        `Persetujuan untuk chat ini: ${consented ? 'aktif' : 'tidak aktif'}.`,
        `Untuk memberi persetujuan: ${context.prefix}archive on`,
        `Untuk menarik persetujuan dan menghapus arsip chat ini: ${context.prefix}archive off`,
        `Untuk melihat data Anda: kirim ${context.prefix}mydata di chat pribadi.`,
        `Untuk menghapus seluruh data Anda: kirim ${context.prefix}deletedata di chat pribadi.`,
      ].join('\n'),
    );
  },
};

const archive = {
  name: 'archive',
  aliases: [],
  description: 'Mengaktifkan atau menarik persetujuan arsip pesan untuk chat ini.',
  category: 'WhatsApp Data',
  usage: 'archive <on|off>',
  redactSender: true,
  execute: async (context) => {
    const choice = context.args[0]?.toLowerCase();
    if (context.args.length !== 1 || !['on', 'off'].includes(choice)) {
      return reply(context, `Gunakan ${context.prefix}archive <on|off>. Lihat ${context.prefix}consent untuk rincian data.`);
    }
    if (choice === 'on' && !config.whatsappData.collectionEnabled) {
      return reply(context, 'Pengumpulan data dinonaktifkan oleh konfigurasi bot. Persetujuan tidak disimpan dan pesan tidak diarsipkan.');
    }
    const identity = getIdentity(context);
    const scope = getChatScope(context);
    if (!identity || !scope) {
      return reply(context, 'Identitas pengirim atau cakupan chat tidak dapat diverifikasi; tidak ada perubahan.');
    }

    const result = await messageScraper.setConsent({
      identity,
      scope,
      enabled: choice === 'on',
    });
    if (!result.success) {
      return reply(context, result.error.message);
    }
    return reply(
      context,
      choice === 'on'
        ? `Pemberitahuan: persetujuan Anda untuk mengarsipkan teks biasa yang Anda kirim di chat ini aktif. Media, View Once, dan pesan peserta lain tidak diarsipkan. Kirim ${context.prefix}archive off untuk menarik persetujuan dan menghapus arsip chat ini.`
        : 'Persetujuan arsip chat ini telah ditarik. Pengumpulan dihentikan dan arsip Anda dalam chat ini telah dihapus.',
    );
  },
};

const mydata = {
  name: 'mydata',
  aliases: [],
  description: 'Menampilkan data arsip milik Anda sendiri.',
  category: 'WhatsApp Data',
  usage: 'mydata',
  redactSender: true,
  execute: async (context) => {
    const identity = await getPrivateIdentity(context);
    if (!identity) {
      return;
    }
    const result = await messageScraper.getStats({
      identity,
    });
    if (!result.success && result.error.code === 'COLLECTION_DISABLED') {
      return reply(context, 'Pengumpulan data dinonaktifkan; arsip tidak dapat diakses.');
    }
    const entries = result.data.slice(-5).map((item) => {
      const location = isGroupJid(item.chatJid) ? 'grup' : 'chat pribadi';
      const text = JSON.stringify(item.text.slice(0, 400));
      return `• ${item.timestamp} (${location}): ${text}`;
    });
    return reply(
      context,
      [
        `Jumlah arsip Anda: ${result.count}.`,
        ...entries,
        result.count > entries.length ? 'Hanya 5 data terbaru yang ditampilkan.' : '',
      ].filter(Boolean).join('\n'),
    );
  },
};

const deletedata = {
  name: 'deletedata',
  aliases: [],
  description: 'Menarik seluruh persetujuan arsip dan menghapus data milik Anda.',
  category: 'WhatsApp Data',
  usage: 'deletedata',
  redactSender: true,
  execute: async (context) => {
    if (isGroupJid(getChatScope(context))) {
      const group = await getGroupContext(context, { requireAdmin: true });
      if (!group) {
        return;
      }
      const result = await memberScraper.deleteData({ groupJid: group.groupJid });
      return reply(context, `Statistik agregat grup dihapus (${result.count} event).`);
    }
    const identity = getIdentity(context);
    if (!identity) {
      return reply(context, 'Identitas pengirim tidak dapat diverifikasi.');
    }
    const result = await messageScraper.deleteData({ identity });
    return reply(context, `Persetujuan arsip Anda dicabut dan ${result.count} data dihapus.`);
  },
};

const scraperstatus = {
  name: 'scraperstatus',
  aliases: [],
  description: 'Menampilkan status pengumpulan data dan statistik agregat grup.',
  category: 'WhatsApp Data',
  usage: 'scraperstatus',
  redactSender: true,
  execute: async (context) => {
    const scope = getChatScope(context);
    const identity = getIdentity(context);
    if (isGroupJid(scope)) {
      const group = await getGroupContext(context, { requireAdmin: true });
      if (!group) {
        return;
      }
      const result = await memberScraper.getStats({ groupJid: group.groupJid });
      if (!result.success) {
        return reply(context, 'Pengumpulan metadata anggota dinonaktifkan oleh konfigurasi bot.');
      }
      const consent = await memberScraper.getConsent({ groupJid: group.groupJid });
      const stats = result.data;
      return reply(
        context,
        [
          `Pengumpulan agregat grup: ${config.whatsappData.collectionEnabled && consent.data.consented ? 'aktif' : 'nonaktif'}.`,
          'Statistik agregat sejak pengumpulan tersedia (retensi terbatas):',
          `Masuk: ${stats.joined}`,
          `Keluar: ${stats.left}`,
          `Promosi admin: ${stats.promoted}`,
          `Demote admin: ${stats.demoted}`,
          `Perubahan bersih: ${stats.netChange}`,
          'Identitas anggota tidak disimpan.',
        ].join('\n'),
      );
    }
    if (!identity || !scope) {
      return reply(context, 'Identitas pengirim tidak dapat diverifikasi.');
    }
    const enabled = config.whatsappData.collectionEnabled;
    const consent =
      enabled
        ? await messageScraper.getConsent({ identity, scope })
        : undefined;
    return reply(
      context,
      `Pengumpulan data: ${enabled ? 'aktif secara konfigurasi' : 'nonaktif'}. Persetujuan arsip chat ini: ${consent?.success && consent.data.consented ? 'aktif' : 'tidak aktif'}.`,
    );
  },
};

const memberstats = {
  name: 'memberstats',
  aliases: [],
  description: 'Mengaktifkan atau menghentikan statistik agregat anggota grup.',
  category: 'WhatsApp Data',
  usage: 'memberstats <on|off>',
  redactSender: true,
  execute: async (context) => {
    const choice = context.args[0]?.toLowerCase();
    if (context.args.length !== 1 || !['on', 'off'].includes(choice)) {
      return reply(context, `Gunakan ${context.prefix}memberstats <on|off>.`);
    }
    const group = await getGroupContext(context, { requireAdmin: true });
    if (!group) {
      return;
    }
    if (choice === 'on' && !config.whatsappData.collectionEnabled) {
      return reply(context, 'Pengumpulan data dinonaktifkan oleh konfigurasi bot; statistik grup tidak diaktifkan.');
    }
    const result = await memberScraper.setConsent({
      groupJid: group.groupJid,
      enabled: choice === 'on',
    });
    if (!result.success) {
      return reply(context, result.error.message);
    }
    return reply(
      context,
      choice === 'on'
        ? `Pemberitahuan: pencatatan agregat event anggota (masuk, keluar, promosi, demote) aktif selama retensi ${config.whatsappData.retentionDays} hari. ID anggota dan nomor telepon tidak disimpan. Admin dapat mengirim ${context.prefix}memberstats off untuk menghentikan dan menghapus statistik.`
        : 'Pencatatan statistik agregat dihentikan dan data statistik grup dihapus.',
    );
  },
};

const whatsappDataCommands = [
  consent,
  archive,
  mydata,
  deletedata,
  scraperstatus,
  memberstats,
];

let registered = false;
const registerWhatsAppDataCommands = () => {
  if (registered) {
    return;
  }
  for (const command of whatsappDataCommands) {
    registerCommand(command);
  }
  registered = true;
};

export {
  archive,
  consent,
  deletedata,
  memberScraper,
  messageScraper,
  memberstats,
  mydata,
  registerWhatsAppDataCommands,
  scraperstatus,
  whatsappDataCommands,
};
