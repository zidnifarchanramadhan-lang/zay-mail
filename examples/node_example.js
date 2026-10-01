/**
 * ZayMail API - Node.js Integration Example
 * Demonstrates how to generate a temporary email, poll for incoming messages,
 * and extract OTP / verification codes automatically using standard fetch or axios.
 */

const BASE_URL = 'https://zaysee.my.id/api';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('[1] Generating a new temporary email address...');
  const createRes = await fetch(`${BASE_URL}/new-address`, { method: 'POST' });
  if (!createRes.ok) throw new Error(`HTTP error! status: ${createRes.status}`);
  const { address, token, expires_in_hours } = await createRes.json();

  console.log(`    Email Address : ${address}`);
  console.log(`    Mailbox Token : ${token}`);
  console.log(`    Expires in    : ${expires_in_hours || 24} hours\n`);

  console.log('[2] Waiting for incoming emails (Polling every 5 seconds)...');
  console.log('    Use the address above to register or request a verification code.\n');

  const maxAttempts = 12; // Poll for up to 60 seconds
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    process.stdout.write(`    Polling attempt ${attempt}/${maxAttempts}...\r`);

    try {
      const inboxRes = await fetch(`${BASE_URL}/messages?address=${encodeURIComponent(address)}`, {
        headers: {
          'X-Mailbox-Token': token
        }
      });

      if (inboxRes.ok) {
        const inbox = await inboxRes.json();
        const messages = inbox.messages || [];

        if (messages.length > 0) {
          console.log(`\n\n[3] Received ${messages.length} message(s)!`);
          for (const msg of messages) {
            console.log('\n    ----------------------------------------');
            console.log(`    From    : ${msg.from}`);
            console.log(`    Subject : ${msg.subject}`);
            console.log(`    Snippet : ${msg.snippet?.substring(0, 120)}...`);

            // Extract OTP (4 to 8 digits)
            const textToScan = `${msg.subject} ${msg.snippet}`;
            const otpMatch = textToScan.match(/\b\d{4,8}\b/);
            if (otpMatch) {
              console.log(`    >> DETECTED OTP: ${otpMatch[0]} <<`);
            }
            console.log('    ----------------------------------------');
          }
          return;
        }
      }
    } catch (err) {
      console.error(`\n    Error polling inbox: ${err.message}`);
    }

    await sleep(5000);
  }

  console.log('\n\n[!] Polling timed out. No messages received.');
}

run().catch(console.error);
