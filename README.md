# 📬 ZayMail REST API — Official Documentation

> **Fast, Secure & Serverless Temporary Email Infrastructure**  
> Running on clean custom domain `@zaysee.my.id` with sub-50ms Cloudflare Edge latency.

[![Service Status](https://img.shields.io/badge/Service-100%25%20Operational-brightgreen?style=flat-square)](https://zaysee.my.id)
[![Domain](https://img.shields.io/badge/Domain-%40zaysee.my.id-yellow?style=flat-square)](https://zaysee.my.id)
[![Latency](https://img.shields.io/badge/Edge%20Latency-%3C50ms-blue?style=flat-square)](https://zaysee.my.id)
[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg?style=flat-square)](LICENSE)

---

## 🌟 Overview

**ZayMail** provides an enterprise-grade REST API for generating temporary, disposable email addresses and fetching incoming verification emails (OTPs, activation links, and receipts).

Unlike public disposable email providers whose domains are heavily blacklisted by fraud detection systems (Google, Discord, OpenAI, Steam, etc.), ZayMail operates on a **clean, privately-managed domain (`@zaysee.my.id`)** with fully configured SPF, DKIM, and MX records.

### Key Features
- **Clean Domain Reputation:** High deliverability rate, bypasses strict bot/disposable email filters.
- **Cryptographic Mailbox Isolation:** Every mailbox is protected by an `X-Mailbox-Token`. Strangers cannot snoop on your emails.
- **Instant Processing:** Emails are processed by Cloudflare Workers at the edge in 1–3 seconds.
- **Developer-Friendly Payloads:** HTML is automatically sanitized, plaintext extracted, and ready for regex parsing (`\b\d{4,8}\b`).
- **Zero DNS Setup:** Standard HTTP REST API accessible from any language (Python, Node.js, Go, PHP, cURL).

---

## 🌐 Base URL

All API requests should be sent to the following base endpoint:

```
https://zaysee.my.id/api
```
*(Alternative gateway: `https://zaymail.pages.dev/api`)*

---

## 🔑 Authentication

Access to mailbox contents is secured via the **`X-Mailbox-Token`** header.  
When you create a mailbox via `POST /api/new-address`, you receive a secret token. You must pass this token in the header when querying messages:

```http
X-Mailbox-Token: zm_xxxxxxxxxxxxxxxxxxxx
```

---

## 📡 API Endpoints

### 1. Generate New Mailbox Address
Creates a fresh disposable email address with a 24-hour retention window.

- **Method:** `POST`
- **Path:** `/api/new-address`
- **Headers:** `Content-Type: application/json`

#### Response (`200 OK`):
```json
{
  "success": true,
  "address": "budi.santoso42@zaysee.my.id",
  "token": "zm_8f3a9e120bc74e5d8a9f",
  "domain": "zaysee.my.id",
  "created_at": "2026-10-01T06:00:00.000Z",
  "expires_in_hours": 24,
  "status": "active"
}
```

---

### 2. Fetch Messages (Inbox)
Retrieves all incoming emails received by the mailbox.

- **Method:** `GET`
- **Path:** `/api/messages?address={email_address}`
- **Headers:**
  - `X-Mailbox-Token: {your_token}`

#### Response (`200 OK`):
```json
{
  "success": true,
  "address": "budi.santoso42@zaysee.my.id",
  "count": 1,
  "messages": [
    {
      "id": "msg_90a1f4b8c7e2",
      "from": "security@service.com",
      "subject": "123456 adalah kode verifikasi Anda",
      "snippet": "Halo! Gunakan kode verifikasi 123456 untuk menyelesaikan pendaftaran akun Anda...",
      "received_at": "2026-10-01T06:01:23.000Z",
      "size": 2410
    }
  ]
}
```

---

### 3. Fetch Single Email Detail
Retrieves the full email content including sanitized HTML and plaintext body.

- **Method:** `GET`
- **Path:** `/api/message/{message_id}?address={email_address}`
- **Headers:**
  - `X-Mailbox-Token: {your_token}`

#### Response (`200 OK`):
```json
{
  "success": true,
  "message": {
    "id": "msg_90a1f4b8c7e2",
    "from": "security@service.com",
    "to": "budi.santoso42@zaysee.my.id",
    "subject": "123456 adalah kode verifikasi Anda",
    "date": "2026-10-01T06:01:23.000Z",
    "text": "Halo! Gunakan kode verifikasi 123456 untuk menyelesaikan pendaftaran akun Anda.",
    "html": "<p>Halo! Gunakan kode verifikasi <strong>123456</strong> untuk menyelesaikan pendaftaran akun Anda.</p>"
  }
}
```

---

### 4. Delete Mailbox / Messages
Permanently deletes all messages associated with the address.

- **Method:** `DELETE`
- **Path:** `/api/messages?address={email_address}`
- **Headers:**
  - `X-Mailbox-Token: {your_token}`

#### Response (`200 OK`):
```json
{
  "success": true,
  "message": "Mailbox cleared successfully"
}
```

---

## 💻 Quickstart Code Examples

### Python (`requests`)
```python
import time
import re
import requests

BASE_URL = "https://zaysee.my.id/api"

# 1. Create a new disposable address
res = requests.post(f"{BASE_URL}/new-address").json()
address = res["address"]
token = res["token"]

print(f"Generated Address: {address}")

# 2. Poll for incoming verification email
headers = {"X-Mailbox-Token": token}

for _ in range(12):  # Poll up to 60 seconds
    time.sleep(5)
    inbox = requests.get(f"{BASE_URL}/messages?address={address}", headers=headers).json()
    messages = inbox.get("messages", [])
    
    if messages:
        msg = messages[0]
        print(f"Subject: {msg['subject']}")
        
        # Extract OTP (e.g. 6-digit code)
        otp = re.search(r'\b\d{4,8}\b', msg["subject"] + " " + msg["snippet"])
        if otp:
            print(f"Detected OTP: {otp.group(0)}")
        break
```

---

### Node.js / JavaScript (`fetch`)
```javascript
const BASE_URL = 'https://zaysee.my.id/api';

async function main() {
  // 1. Generate email
  const createRes = await fetch(`${BASE_URL}/new-address`, { method: 'POST' });
  const { address, token } = await createRes.json();
  console.log(`Address: ${address}`);

  // 2. Poll inbox
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    
    const res = await fetch(`${BASE_URL}/messages?address=${address}`, {
      headers: { 'X-Mailbox-Token': token }
    });
    const { messages } = await res.json();

    if (messages && messages.length > 0) {
      console.log(`From: ${messages[0].from}`);
      console.log(`Subject: ${messages[0].subject}`);
      
      const otp = (messages[0].subject + ' ' + messages[0].snippet).match(/\b\d{4,8}\b/);
      if (otp) console.log(`OTP: ${otp[0]}`);
      break;
    }
  }
}

main();
```

---

### cURL
```bash
# 1. Generate Address
curl -X POST https://zaysee.my.id/api/new-address

# 2. Check Messages
curl -X GET "https://zaysee.my.id/api/messages?address=YOUR_ADDRESS" \
  -H "X-Mailbox-Token: YOUR_TOKEN"
```

---

## ⏱️ Recommended Automation Practices

1. **Polling Frequency:** Query `GET /api/messages` every **5 to 8 seconds**. Avoid tight continuous loops (<1s) to prevent hitting edge rate limiters.
2. **Regex OTP Detection:** For most modern platforms (WhatsApp, Telegram, Google, Discord, TikTok), standard regex will extract verification codes effortlessly:
   ```regex
   \b\d{4,8}\b
   ```
3. **Token Storage:** Always save the `token` alongside the `address` in your script's session state. The token is never re-transmitted once issued.

---

## 📦 Access Plans & Inquiries

ZayMail API is available for developers, QA engineers, automation bots, and data scrapers:

| Plan | Daily Quota | Rate Limit | Custom Prefix | Support |
| :--- | :--- | :--- | :--- | :--- |
| **Starter Dev** | 1,000 req/day | 30 req/min | Random | Community |
| **Pro Automation** | 15,000 req/day | 120 req/min | Kustom Prefix | Priority WhatsApp |
| **Enterprise** | Unlimited | High Throughput | Custom Domain / Webhook | 24/7 Dedicated |

For API keys, token activation, or custom enterprise requirements:
- **WhatsApp Contact:** [Chat on WhatsApp (+62 895-3791-64169)](https://wa.me/62895379164169?text=Halo%20Zay!%20Saya%20ingin%20akses%20API%20ZayMail%20untuk%20proyek%20saya.)
- **Web UI & Sandbox:** [https://zaysee.my.id](https://zaysee.my.id)

---

## 📄 License

This documentation and example code are distributed under the [MIT License](LICENSE).
