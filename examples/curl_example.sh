#!/usr/bin/env bash
# ZayMail API - cURL / Bash Quickstart Example

BASE_URL="https://zaysee.my.id/api"

echo "=========================================="
echo " 1. Generate New Temporary Mailbox Address"
echo "=========================================="
RESPONSE=$(curl -s -X POST "$BASE_URL/new-address")
echo "$RESPONSE" | grep -o . | head -n 0 # test

ADDRESS=$(echo "$RESPONSE" | grep -o '"address":"[^"]*' | cut -d'"' -f4)
TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "Generated Address: $ADDRESS"
echo "Mailbox Token    : $TOKEN"
echo ""

echo "=========================================="
echo " 2. Fetch Messages (Polling)"
echo "=========================================="
curl -s -X GET "$BASE_URL/messages?address=$ADDRESS" \
  -H "X-Mailbox-Token: $TOKEN" | jq .

echo ""
echo "Done."
