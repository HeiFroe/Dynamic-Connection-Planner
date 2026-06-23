#!/bin/bash
# implement-rule.sh
# Called by dcdc:// URI handler when user clicks "Implement in VS Code".

set -euo pipefail

VAULT_PATH="$HOME/Projects/dcdc-vault"
APP_PATH="$HOME/dynamic-connection-planner"
OBSIDIAN_API="http://localhost:27123"
OBSIDIAN_KEY="62e91023c6c3426330d7b1e51c55f11efa23f033098c6a1885aed9954d2fb746"
VSCODE_BIN="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
CLAUDE_BIN="$HOME/.local/bin/claude"

RULE_PATH="${1:-}"
if [ -z "$RULE_PATH" ]; then
  osascript -e 'display notification "No rule path provided" with title "DCDC: Error"'
  exit 1
fi

RULE_FILE="$VAULT_PATH/$RULE_PATH"
if [ ! -f "$RULE_FILE" ]; then
  osascript -e "display notification \"Rule file not found\" with title \"DCDC: Error\""
  exit 1
fi

RULE_ID=$(grep "^rule-id:" "$RULE_FILE" | sed 's/rule-id: *//' | tr -d '"' | xargs)
RULE_NAME=$(grep "^rule-name:" "$RULE_FILE" | sed 's/rule-name: *//' | tr -d '"' | xargs)

# ── Cleanup stale temp files ──────────────────────────────────────────────────
rm -f /tmp/dcdc-rule-prompt-XXXXXX.txt /tmp/dcdc-launcher-XXXXXX.sh 2>/dev/null || true

# ── Mark as implementing in Obsidian ─────────────────────────────────────────
curl -s -X PATCH "$OBSIDIAN_API/vault/$RULE_PATH" \
  -H "Authorization: Bearer $OBSIDIAN_KEY" \
  -H "Content-Type: application/json" \
  --data-raw '{"operation":"replace","targetType":"frontmatter","target":"status","content":"implementing"}' \
  > /dev/null 2>&1 || true

# ── Write prompt file ─────────────────────────────────────────────────────────
PROMPT_FILE=$(mktemp "/tmp/dcdc-XXXXXX.md")

{
  echo "# Implement $RULE_ID — $RULE_NAME"
  echo ""
  echo "Read the full rule below, then implement it in the DCDC codebase."
  echo ""
  echo "---"
  echo ""
  cat "$RULE_FILE"
  echo ""
  echo "---"
  echo ""
  echo "## Tasks"
  echo ""
  echo "1. Implement the rule in the appropriate file(s)"
  echo "2. Run \`npx tsc --noEmit\` — must pass with 0 errors"
  echo "3. When done, run:"
  echo ""
  echo '```bash'
  echo "bash $APP_PATH/.claude/rule-done.sh \"$RULE_PATH\" \"<file>\" \"<function>\" \"<line>\""
  echo '```'
} > "$PROMPT_FILE"

# ── Write self-contained launcher script ──────────────────────────────────────
LAUNCHER=$(mktemp "/tmp/dcdc-run-XXXXXX.sh")
# Use printf to avoid any escaping issues with the prompt content
printf '#!/bin/bash\ncd %s\necho ""\necho "╔══════════════════════════════════════════╗"\necho "║  DCDC: %s — %s"\necho "╚══════════════════════════════════════════╝"\necho ""\n%s --print "$(cat %s)"\nrm -f %s %s\n' \
  "$APP_PATH" "$RULE_ID" "$RULE_NAME" \
  "$CLAUDE_BIN" "$PROMPT_FILE" \
  "$PROMPT_FILE" "$LAUNCHER" > "$LAUNCHER"
chmod +x "$LAUNCHER"

# ── Open VS Code ──────────────────────────────────────────────────────────────
"$VSCODE_BIN" "$APP_PATH" > /dev/null 2>&1 &

# ── Launch Terminal using open -a instead of Apple Events ────────────────────
# Write a wrapper that opens a new Terminal tab without Apple Events
TERM_SCRIPT=$(mktemp "/tmp/dcdc-term-XXXXXX.sh")
cat > "$TERM_SCRIPT" << TERMSCRIPT
#!/bin/bash
# Run in background, open new terminal window via 'open'
open -a Terminal "$LAUNCHER"
rm -f "$TERM_SCRIPT"
TERMSCRIPT
chmod +x "$TERM_SCRIPT"
bash "$TERM_SCRIPT" &

# ── Notify ────────────────────────────────────────────────────────────────────
sleep 0.5
osascript -e "display notification \"Claude started: $RULE_NAME\" with title \"DCDC: Implementing\""
