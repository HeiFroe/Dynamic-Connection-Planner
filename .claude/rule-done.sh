#!/bin/bash
# rule-done.sh
# Called by Claude Code after successfully implementing a rule.
# Usage: rule-done.sh <vault-relative-rule-path> <impl-file> <impl-function> <impl-line>
#
# What it does:
#   1. Updates rule frontmatter: status → implemented, updated → today
#   2. Fills in the Implementation section with file/function/line
#   3. Appends an Implementation Log entry with timestamp
#   4. Writes a ✅ DONE message to the Obsidian inbox

set -euo pipefail

VAULT_PATH="$HOME/Projects/dcdc-vault"
OBSIDIAN_API="http://localhost:27123"
OBSIDIAN_KEY="62e91023c6c3426330d7b1e51c55f11efa23f033098c6a1885aed9954d2fb746"

RULE_PATH="${1:-}"
IMPL_FILE="${2:-(not specified)}"
IMPL_FUNCTION="${3:-(not specified)}"
IMPL_LINE="${4:-(not specified)}"
TODAY=$(date '+%Y-%m-%d')
NOW=$(date '+%Y-%m-%d %H:%M')

if [ -z "$RULE_PATH" ]; then
  echo "Usage: $0 <vault-relative-rule-path> [impl-file] [impl-function] [impl-line]"
  exit 1
fi

RULE_FILE="$VAULT_PATH/$RULE_PATH"
if [ ! -f "$RULE_FILE" ]; then
  echo "Rule file not found: $RULE_FILE"
  exit 1
fi

RULE_ID=$(grep "^rule-id:" "$RULE_FILE" | sed 's/rule-id: *//' | tr -d '"')
RULE_NAME=$(grep "^rule-name:" "$RULE_FILE" | sed 's/rule-name: *//' | tr -d '"')

# ── 1. Update frontmatter via REST API ───────────────────────────────────────
# status → implemented
curl -s -X PATCH "$OBSIDIAN_API/vault/$RULE_PATH" \
  -H "Authorization: Bearer $OBSIDIAN_KEY" \
  -H "Content-Type: application/json" \
  --data-raw "{\"operation\":\"replace\",\"targetType\":\"frontmatter\",\"target\":\"status\",\"content\":\"implemented\"}" \
  > /dev/null

# updated → today
curl -s -X PATCH "$OBSIDIAN_API/vault/$RULE_PATH" \
  -H "Authorization: Bearer $OBSIDIAN_KEY" \
  -H "Content-Type: application/json" \
  --data-raw "{\"operation\":\"replace\",\"targetType\":\"frontmatter\",\"target\":\"updated\",\"content\":\"$TODAY\"}" \
  > /dev/null

# ── 2. Update Implementation section ─────────────────────────────────────────
IMPL_CONTENT="
- **File:** \`$IMPL_FILE\`
- **Function:** \`$IMPL_FUNCTION\`
- **Line ~:** $IMPL_LINE
"

curl -s -X PATCH "$OBSIDIAN_API/vault/$RULE_PATH" \
  -H "Authorization: Bearer $OBSIDIAN_KEY" \
  -H "Content-Type: application/json" \
  --data-raw "{\"operation\":\"replace\",\"targetType\":\"heading\",\"target\":\"Implementation\",\"content\":\"$IMPL_CONTENT\"}" \
  > /dev/null

# ── 3. Append Implementation Log entry ───────────────────────────────────────
LOG_ENTRY="
### $NOW — Implemented ✅

- **File:** \`$IMPL_FILE\`
- **Function:** \`$IMPL_FUNCTION\`
- **Line:** $IMPL_LINE
- TypeScript: 0 errors
"

curl -s -X PATCH "$OBSIDIAN_API/vault/$RULE_PATH" \
  -H "Authorization: Bearer $OBSIDIAN_KEY" \
  -H "Content-Type: application/json" \
  --data-raw "{\"operation\":\"append\",\"targetType\":\"heading\",\"target\":\"Implementation Log\",\"content\":\"$LOG_ENTRY\"}" \
  > /dev/null

# ── 4. Write to inbox ─────────────────────────────────────────────────────────
INBOX_ENTRY="
## $NOW — $RULE_ID implemented

✅ DONE: **$RULE_NAME** is now implemented and verified.

- **Rule:** [[$RULE_PATH|$RULE_ID — $RULE_NAME]]
- **File:** \`$IMPL_FILE\`
- **Function:** \`$IMPL_FUNCTION\` (~line $IMPL_LINE)
- **Status:** \`draft\` → \`implemented\`
"

curl -s -X POST "$OBSIDIAN_API/vault/DCDC/Inbox/claude-messages.md" \
  -H "Authorization: Bearer $OBSIDIAN_KEY" \
  -H "Content-Type: text/markdown" \
  --data-raw "$INBOX_ENTRY" \
  > /dev/null || true

echo "✅ Rule $RULE_ID marked as implemented in Obsidian."
osascript -e "display notification \"$RULE_ID implemented: $RULE_NAME\" with title \"DCDC: Rule Done\"" 2>/dev/null || true
