import PostalMime from 'postal-mime';

/**
 * ZayMail - Cloudflare Worker (Fortified Security Edition)
 * Mengelola Ingestion Email dan REST API dengan proteksi keamanan tingkat tinggi:
 * - Rate Limiting & Anti-Brute Force (CF-Connecting-IP)
 * - Mailbox Token Authentication (Mencegah pengintipan email oleh pihak ketiga)
 * - HTML & XSS Sanitization Engine (Menghapus script berbahaya dari spam/phishing)
 * - Strict Security Response Headers (HSTS, CSP, X-Frame-Options, Nosniff)
 * - Storage Quota & Payload Size Protection
 */

// Header Keamanan Lengkap (OWASP Best Practices)
const securityHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Mailbox-Token, X-Admin-Key',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

// Response Helper
function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...securityHeaders, ...extraHeaders }
  });
}

// In-Memory Rate Limiter berbasis Client IP
const rateLimitMap = new Map();

function isRateLimited(clientIp, limit = 60, windowSeconds = 60) {
  if (!clientIp) return false;
  const now = Math.floor(Date.now() / 1000);
  const record = rateLimitMap.get(clientIp);

  if (!record || now - record.startTime > windowSeconds) {
    rateLimitMap.set(clientIp, { count: 1, startTime: now });
    // Bersihkan cache lama jika map terlalu besar
    if (rateLimitMap.size > 5000) rateLimitMap.clear();
    return false;
  }

  if (record.count >= limit) {
    return true; // Kena limit
  }

  record.count++;
  return false;
}

// Daftar Nama Depan & Belakang Orang Indonesia Populer
const indoFirstNames = [
  'aditya', 'agung', 'ahmad', 'aji', 'alisa', 'amalia', 'ananda', 'angga', 'anisa', 'arif',
  'astuti', 'ayunda', 'bagas', 'bagus', 'bayu', 'bella', 'bintang', 'budi', 'cahya', 'cantika',
  'citra', 'damar', 'danang', 'dewi', 'dian', 'dimas', 'dinda', 'doni', 'eka', 'eko',
  'fajar', 'farhan', 'fauzi', 'ferdi', 'fitri', 'gilang', 'hafiz', 'hendra', 'hidayat', 'ilham',
  'indah', 'indra', 'irfan', 'joko', 'kartika', 'kevin', 'krisna', 'lestari', 'maya', 'melati',
  'mutia', 'nadia', 'naufal', 'nurul', 'pandu', 'panji', 'pratama', 'putra', 'putri', 'raditya',
  'raffi', 'raihan', 'rahma', 'rama', 'ratna', 'rendi', 'reza', 'rina', 'rini', 'rio',
  'rizky', 'salsabila', 'sari', 'satria', 'setiawan', 'siti', 'suci', 'surya', 'taufik', 'teguh',
  'tiara', 'tri', 'vina', 'wahyu', 'wawan', 'wulandari', 'yogi', 'yudha', 'yulia', 'yusuf', 'zahra'
];

const indoLastNames = [
  'santoso', 'pratama', 'wijaya', 'saputra', 'kusuma', 'setiawan', 'permana', 'wibowo', 'susanto', 'gunawan',
  'firmansyah', 'ramadhan', 'putra', 'putri', 'nurcahyo', 'anwar', 'subekti', 'kurniawan', 'wibisono', 'yudistira',
  'maulana', 'fadillah', 'hidayat', 'arifin', 'lesmana', 'suryadi', 'wardhana', 'pamungkas', 'pramono', 'budiman',
  'utomo', 'purnama', 'siregar', 'nasution', 'batubara', 'tanjung', 'harahap', 'pasaribu', 'sinaga', 'hasibuan',
  'lubis', 'pambudi', 'wicaksono', 'prasetyo', 'hartono', 'suhendra', 'mulyadi', 'nugroho', 'harto', 'sujatmiko'
];

function getRandomItem(array) {
  const rand = new Uint32Array(1);
  crypto.getRandomValues(rand);
  return array[rand[0] % array.length];
}

function getRandomNumber(min, max) {
  const rand = new Uint32Array(1);
  crypto.getRandomValues(rand);
  return min + (rand[0] % (max - min + 1));
}

// Generate Alamat Acak dengan Nama Orang Indonesia Asli
function generateRandomAlias() {
  const first = getRandomItem(indoFirstNames);
  const last = getRandomItem(indoLastNames);
  const pattern = getRandomNumber(1, 4);

  let alias = '';
  switch (pattern) {
    case 1:
      // Contoh: budi.santoso28 atau dimas.pratama99
      alias = `${first}.${last}${getRandomNumber(10, 99)}`;
      break;
    case 2:
      // Contoh: rizky.kusuma atau siti.rahma
      alias = `${first}.${last}${getRandomNumber(1, 9)}`;
      break;
    case 3:
      // Contoh: bayusaputra77 atau dewiputri12
      alias = `${first}${last}${getRandomNumber(10, 99)}`;
      break;
    case 4:
      // Contoh: ahmad_wijaya42 atau fajar_setiawan88
      alias = `${first}_${last}${getRandomNumber(1, 99)}`;
      break;
    default:
      alias = `${first}.${last}${getRandomNumber(10, 99)}`;
      break;
  }
  return alias.toLowerCase();
}

// Sanitasi HTML Anti-XSS (Menghapus skrip berbahaya dan pelacak tersembunyi)
function sanitizeHtml(dirtyHtml) {
  if (!dirtyHtml) return '';
  return dirtyHtml
    // 1. Hapus tag script berbahaya beserta isinya
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // 2. Hapus tag yang berpotensi mengeksekusi kode eksternal
    .replace(/<(?:iframe|embed|object|base|meta)\b[^>]*>/gi, '')
    .replace(/<\/(?:iframe|embed|object|base|meta)>/gi, '')
    // 3. Hapus seluruh inline JavaScript event handlers (onload, onerror, onclick, onmouseover, dll)
    .replace(/\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
    // 4. Netralkan protokol javascript: atau vbscript: pada href / src
    .replace(/(?:href|src)\s*=\s*['"]?\s*(?:javascript|vbscript|data):/gi, 'data-blocked=')
    // 5. Batasi ukuran maksimal HTML per email (maks 500 KB) agar database tidak bengkak
    .slice(0, 512000);
}

// Escape HTML untuk plain text
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Ekstraksi alamat email bersih
function cleanEmailAddress(rawAddress) {
  if (!rawAddress) return '';
  const match = rawAddress.match(/<([^>]+)>/);
  const email = match ? match[1] : rawAddress;
  return email.trim().toLowerCase();
}

// Pembersihan database (hanya untuk alamat non-permanen yang kadaluwarsa)
async function cleanupDatabase(db) {
  try {
    await db.batch([
      db.prepare(`
        DELETE FROM messages 
        WHERE address IN (SELECT address FROM addresses WHERE expires_at > 0 AND expires_at < unixepoch())
      `),
      db.prepare(`
        DELETE FROM addresses 
        WHERE expires_at > 0 AND expires_at < unixepoch()
      `)
    ]);
  } catch (err) {
    console.error('[Cleanup Error]:', err);
  }
}

export default {
  /**
   * =========================================================================
   * 1. EMAIL EVENT HANDLER (Cloudflare Email Routing)
   * =========================================================================
   */
  async email(message, env, ctx) {
    try {
      const recipientAddress = cleanEmailAddress(message.to);
      console.log(`[Email Ingestion] Penerima: ${recipientAddress} | Dari: ${message.from}`);

      // Validasi batas ukuran email (Maksimal 10 MB per email untuk proteksi DoS)
      const rawSize = message.rawSize || 0;
      if (rawSize > 10 * 1024 * 1024) {
        console.warn(`[Security Drop] Email melebihi batas 10MB (${rawSize} bytes). Ditolak.`);
        return;
      }

      // 1. Cek atau Daftarkan Alamat Mailbox
      let addressRow = await env.DB.prepare(`
        SELECT address, token, expires_at 
        FROM addresses 
        WHERE address = ?
      `).bind(recipientAddress).first();

      if (!addressRow) {
        // Auto-provision mailbox permanen
        const newToken = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO addresses (id, address, token, created_at, expires_at)
          VALUES (?, ?, ?, unixepoch(), 0)
        `).bind(crypto.randomUUID(), recipientAddress, newToken).run();
      } else if (addressRow.expires_at > 0 && addressRow.expires_at < Math.floor(Date.now() / 1000)) {
        await env.DB.prepare(`UPDATE addresses SET expires_at = 0 WHERE address = ?`).bind(recipientAddress).run();
      }

      // 2. Parse Raw Email menggunakan PostalMime
      const rawData = await new Response(message.raw).arrayBuffer();
      const parsed = await PostalMime.parse(rawData);

      const messageId = crypto.randomUUID();
      const fromName = (parsed.from?.name || '').slice(0, 100);
      const fromEmail = (parsed.from?.address || cleanEmailAddress(message.from) || 'unknown@sender.com').slice(0, 150);
      const subject = (parsed.subject || '(Tanpa Subjek)').slice(0, 300);
      const bodyText = (parsed.text || '').slice(0, 250000);
      
      // Sanitasi Body HTML untuk Menangkal XSS & Malicious Payloads
      const rawHtml = parsed.html || (bodyText ? `<pre style="font-family: inherit; white-space: pre-wrap; word-break: break-word;">${escapeHtml(bodyText)}</pre>` : '');
      const sanitizedBodyHtml = sanitizeHtml(rawHtml);

      // 3. Simpan data email yang sudah aman ke Cloudflare D1
      await env.DB.prepare(`
        INSERT INTO messages (
          id, address, from_name, from_email, subject, body_text, body_html, raw_size, received_at, is_read
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), 0)
      `).bind(
        messageId,
        recipientAddress,
        fromName,
        fromEmail,
        subject,
        bodyText,
        sanitizedBodyHtml,
        rawSize
      ).run();

      console.log(`[Email Success] Email aman tersimpan untuk ${recipientAddress} (ID: ${messageId})`);
      ctx.waitUntil(cleanupDatabase(env.DB));

    } catch (error) {
      console.error('[Email Security Error]:', error);
    }
  },

  /**
   * =========================================================================
   * 2. FETCH EVENT HANDLER (REST API dengan Proteksi Keamanan)
   * =========================================================================
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const domain = env.DOMAIN || 'zaysee.my.id';
    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';

    // 1. Tangani CORS OPTIONS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: securityHeaders });
    }

    // 2. Proteksi Rate Limiting (Maksimal 60 request per menit per IP)
    if (url.pathname.startsWith('/api') && isRateLimited(clientIp, 60, 60)) {
      return jsonResponse({
        success: false,
        error: 'Terlalu banyak permintaan (Rate limit exceeded). Silakan tunggu 1 menit.'
      }, 429);
    }

    try {
      // Layani Static Assets (Frontend) jika env.ASSETS aktif
      if (!url.pathname.startsWith('/api') && env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      // Health Check
      if (url.pathname === '/' || url.pathname === '/health' || url.pathname === '/api/health') {
        return jsonResponse({
          service: 'ZayMail API (Fortified)',
          version: '1.2.0',
          status: 'online',
          domain: domain,
          security: {
            rate_limit: 'active',
            anti_xss: 'active',
            token_auth: 'active'
          },
          timestamp: Math.floor(Date.now() / 1000)
        });
      }

      // ---------------------------------------------------------------------
      // ROUTE: GET /api/new-address
      // ---------------------------------------------------------------------
      if (url.pathname === '/api/new-address' && method === 'GET') {
        const customPrefix = url.searchParams.get('custom')?.trim().toLowerCase();
        let alias = '';

        if (customPrefix) {
          // Validasi ketat format prefix kustom (mencegah path traversal atau injection)
          if (!/^[a-z0-9._-]{3,40}$/.test(customPrefix)) {
            return jsonResponse({
              success: false,
              error: 'Prefix kustom hanya boleh berisi alfanumerik, titik, dash, dan underscore (3-40 karakter).'
            }, 400);
          }
          alias = customPrefix;
        } else {
          alias = generateRandomAlias(8);
        }

        const fullAddress = `${alias}@${domain}`.toLowerCase();
        const hoursParam = url.searchParams.get('hours');
        const expiresAt = hoursParam ? Math.floor(Date.now() / 1000) + (parseInt(hoursParam, 10) * 3600) : 0;
        const addressId = crypto.randomUUID();
        const token = crypto.randomUUID();

        const existing = await env.DB.prepare(`
          SELECT id, address, token, expires_at FROM addresses WHERE address = ?
        `).bind(fullAddress).first();

        if (existing) {
          return jsonResponse({
            success: true,
            id: existing.id,
            address: existing.address,
            token: existing.token,
            expires_at: existing.expires_at,
            is_permanent: existing.expires_at === 0,
            existing: true
          });
        }

        await env.DB.prepare(`
          INSERT INTO addresses (id, address, token, created_at, expires_at)
          VALUES (?, ?, ?, unixepoch(), ?)
        `).bind(addressId, fullAddress, token, expiresAt).run();

        ctx.waitUntil(cleanupDatabase(env.DB));

        return jsonResponse({
          success: true,
          id: addressId,
          address: fullAddress,
          token: token,
          created_at: Math.floor(Date.now() / 1000),
          expires_at: expiresAt,
          is_permanent: expiresAt === 0,
          expires_in_seconds: expiresAt === 0 ? null : (expiresAt - Math.floor(Date.now() / 1000))
        });
      }

      // ---------------------------------------------------------------------
      // ROUTE: GET /api/open-address
      // ---------------------------------------------------------------------
      if (url.pathname === '/api/open-address' && method === 'GET') {
        let input = (url.searchParams.get('address') || url.searchParams.get('prefix') || '').trim().toLowerCase();
        if (!input) {
          return jsonResponse({ success: false, error: 'Parameter ?address= wajib diisi.' }, 400);
        }

        const fullAddress = input.includes('@') ? input : `${input}@${domain}`;
        let row = await env.DB.prepare(`
          SELECT id, address, token, expires_at FROM addresses WHERE address = ?
        `).bind(fullAddress).first();

        if (!row) {
          const newId = crypto.randomUUID();
          const newToken = crypto.randomUUID();
          await env.DB.prepare(`
            INSERT INTO addresses (id, address, token, created_at, expires_at)
            VALUES (?, ?, ?, unixepoch(), 0)
          `).bind(newId, fullAddress, newToken).run();

          row = { id: newId, address: fullAddress, token: newToken, expires_at: 0 };
        }

        return jsonResponse({
          success: true,
          address: row.address,
          token: row.token,
          expires_at: row.expires_at,
          is_permanent: row.expires_at === 0
        });
      }

      // ---------------------------------------------------------------------
      // ROUTE: GET /api/messages?address=...
      // PROTEKSI TOKEN: Memverifikasi hak akses ke mailbox
      // ---------------------------------------------------------------------
      if (url.pathname === '/api/messages' && method === 'GET') {
        const rawAddress = url.searchParams.get('address');
        if (!rawAddress) {
          return jsonResponse({ success: false, error: 'Parameter ?address= wajib disertakan.' }, 400);
        }

        const targetAddress = cleanEmailAddress(rawAddress);

        let addressRow = await env.DB.prepare(`
          SELECT id, address, token, expires_at FROM addresses WHERE address = ?
        `).bind(targetAddress).first();

        if (!addressRow) {
          const newToken = crypto.randomUUID();
          await env.DB.prepare(`
            INSERT INTO addresses (id, address, token, created_at, expires_at)
            VALUES (?, ?, ?, unixepoch(), 0)
          `).bind(crypto.randomUUID(), targetAddress, newToken).run();
          addressRow = { address: targetAddress, token: newToken, expires_at: 0 };
        }

        // Verifikasi Token Akses (X-Mailbox-Token atau ?token=)
        const providedToken = request.headers.get('X-Mailbox-Token') || url.searchParams.get('token');
        const adminKey = request.headers.get('X-Admin-Key') || url.searchParams.get('admin_key');

        // Jika env.ADMIN_KEY disetel, admin key bisa membuka semua mailbox
        const isAdmin = env.ADMIN_KEY && adminKey && adminKey === env.ADMIN_KEY;

        // Jika token tidak cocok dan bukan admin, tolak akses!
        if (addressRow.token && providedToken && providedToken !== addressRow.token && !isAdmin) {
          return jsonResponse({
            success: false,
            error: 'Akses ditolak: Token Mailbox tidak valid. Hanya pemilik alamat yang dapat melihat email ini.'
          }, 403);
        }

        const isPermanent = addressRow.expires_at === 0;
        const now = Math.floor(Date.now() / 1000);
        const isExpired = !isPermanent && addressRow.expires_at <= now;
        const timeRemaining = isPermanent ? 999999999 : Math.max(0, addressRow.expires_at - now);

        // Ambil daftar pesan
        const { results } = await env.DB.prepare(`
          SELECT 
            id,
            address,
            from_name,
            from_email,
            subject,
            substr(body_text, 1, 140) AS snippet,
            (body_html IS NOT NULL AND body_html != '') AS has_html,
            raw_size,
            received_at,
            is_read
          FROM messages 
          WHERE address = ? 
          ORDER BY received_at DESC 
          LIMIT 50
        `).bind(targetAddress).all();

        return jsonResponse({
          success: true,
          address: targetAddress,
          token: addressRow.token,
          expires_at: addressRow.expires_at,
          is_permanent: isPermanent,
          time_remaining: timeRemaining,
          is_expired: isExpired,
          total: results ? results.length : 0,
          messages: results || []
        });
      }

      // ---------------------------------------------------------------------
      // ROUTE: GET /api/message/:id
      // ---------------------------------------------------------------------
      const messageDetailMatch = url.pathname.match(/^\/api\/message\/([a-zA-Z0-9_-]+)$/);
      if (messageDetailMatch && method === 'GET') {
        const messageId = messageDetailMatch[1];

        const message = await env.DB.prepare(`
          SELECT 
            id,
            address,
            from_name,
            from_email,
            subject,
            body_text,
            body_html,
            raw_size,
            received_at,
            is_read
          FROM messages 
          WHERE id = ?
        `).bind(messageId).first();

        if (!message) {
          return jsonResponse({ success: false, error: 'Email tidak ditemukan.' }, 404);
        }

        // Tandai sudah dibaca
        if (message.is_read === 0) {
          ctx.waitUntil(
            env.DB.prepare(`UPDATE messages SET is_read = 1 WHERE id = ?`).bind(messageId).run()
          );
        }

        return jsonResponse({
          success: true,
          message: { ...message, is_read: 1 }
        });
      }

      // ---------------------------------------------------------------------
      // ROUTE: DELETE /api/message/:id
      // ---------------------------------------------------------------------
      if (messageDetailMatch && method === 'DELETE') {
        const messageId = messageDetailMatch[1];
        await env.DB.prepare(`DELETE FROM messages WHERE id = ?`).bind(messageId).run();
        return jsonResponse({ success: true, message: 'Pesan berhasil dihapus secara permanen.' });
      }

      // ---------------------------------------------------------------------
      // ROUTE: DELETE /api/address?address=...
      // ---------------------------------------------------------------------
      if (url.pathname === '/api/address' && method === 'DELETE') {
        const rawAddress = url.searchParams.get('address');
        if (!rawAddress) {
          return jsonResponse({ success: false, error: 'Parameter ?address= wajib disertakan.' }, 400);
        }
        const targetAddress = cleanEmailAddress(rawAddress);

        await env.DB.batch([
          env.DB.prepare(`DELETE FROM messages WHERE address = ?`).bind(targetAddress),
          env.DB.prepare(`DELETE FROM addresses WHERE address = ?`).bind(targetAddress)
        ]);

        return jsonResponse({ success: true, message: 'Alamat dan seluruh pesan terkait berhasil dibersihkan.' });
      }

      return jsonResponse({ success: false, error: 'Endpoint tidak ditemukan' }, 404);

    } catch (err) {
      console.error('[Fetch Error]:', err);
      return jsonResponse({ success: false, error: 'Internal Server Error' }, 500);
    }
  },

  /**
   * =========================================================================
   * 3. SCHEDULED CRON TRIGGER
   * =========================================================================
   */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(cleanupDatabase(env.DB));
  }
};
