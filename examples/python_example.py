#!/usr/bin/env python3
"""
ZayMail API - Python Integration Example
Demonstrates how to generate a temporary email, poll for incoming messages,
and extract OTP / verification codes automatically.
"""

import time
import re
import requests

BASE_URL = "https://zaysee.my.id/api"

def main():
    print("[1] Generating a new temporary email address...")
    res = requests.post(f"{BASE_URL}/new-address")
    res.raise_for_status()
    data = res.json()

    address = data["address"]
    token = data["token"]

    print(f"    Email Address : {address}")
    print(f"    Mailbox Token : {token}")
    print(f"    Expires in    : {data.get('expires_in_hours', 24)} hours\n")

    # Header is required to access the mailbox securely
    headers = {
        "X-Mailbox-Token": token
    }

    print("[2] Waiting for incoming emails (Polling every 5 seconds)...")
    print("    Use the address above to register or request a verification code.\n")

    max_attempts = 12  # Poll for up to 60 seconds
    for attempt in range(1, max_attempts + 1):
        print(f"    Polling attempt {attempt}/{max_attempts}...", end="\r")
        
        try:
            inbox_res = requests.get(
                f"{BASE_URL}/messages",
                params={"address": address},
                headers=headers,
                timeout=10
            )
            inbox_res.raise_for_status()
            inbox = inbox_res.json()
            messages = inbox.get("messages", [])

            if messages:
                print(f"\n\n[3] Received {len(messages)} message(s)!")
                for msg in messages:
                    subject = msg.get("subject", "(No Subject)")
                    sender = msg.get("from", "Unknown")
                    snippet = msg.get("snippet", "")
                    
                    print(f"\n    ----------------------------------------")
                    print(f"    From    : {sender}")
                    print(f"    Subject : {subject}")
                    print(f"    Preview : {snippet[:120]}...")

                    # Search for 4 to 8 digit OTP codes
                    otp_match = re.search(r'\b\d{4,8}\b', subject + " " + snippet)
                    if otp_match:
                        print(f"    >> DETECTED OTP: {otp_match.group(0)} <<")
                    print(f"    ----------------------------------------")
                return

        except Exception as e:
            print(f"\n    Error polling inbox: {e}")

        time.sleep(5)

    print("\n\n[!] Polling timed out. No messages received yet.")

if __name__ == "__main__":
    main()
