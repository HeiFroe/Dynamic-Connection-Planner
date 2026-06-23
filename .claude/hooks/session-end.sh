#!/bin/bash
# Session-Ende Hook: Schreibt Abschluss-Notiz in Obsidian Inbox

TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
VAULT="/Users/c5263507/Projects/dcdc-vault"
INBOX="$VAULT/DCDC/Inbox/claude-messages.md"

# Letzten Git-Diff zusammenfassen (max 10 geänderte Dateien)
CHANGED=$(cd /Users/c5263507/dynamic-connection-planner && git diff --name-only HEAD 2>/dev/null | head -10)
STAGED=$(cd /Users/c5263507/dynamic-connection-planner && git diff --cached --name-only 2>/dev/null | head -10)
UNTRACKED=$(cd /Users/c5263507/dynamic-connection-planner && git ls-files --others --exclude-standard 2>/dev/null | head -5)

ALL_CHANGED=""
[ -n "$CHANGED" ] && ALL_CHANGED="Geändert: $CHANGED"
[ -n "$STAGED" ] && ALL_CHANGED="$ALL_CHANGED | Staged: $STAGED"
[ -n "$UNTRACKED" ] && ALL_CHANGED="$ALL_CHANGED | Neu: $UNTRACKED"
[ -z "$ALL_CHANGED" ] && ALL_CHANGED="Keine Git-Änderungen"

# Test-Ergebnis lesen falls vorhanden
TEST_RESULT=""
if [ -f /tmp/dcdc-test-result.txt ]; then
    LAST_TEST=$(tail -5 /tmp/dcdc-test-result.txt)
    TEST_RESULT="**Letzter Test:** $LAST_TEST"
    rm -f /tmp/dcdc-test-result.txt
fi

# Inbox-Eintrag schreiben
cat >> "$INBOX" << EOF

## $TIMESTAMP — Session beendet

📋 INFO: Claude Code Session abgeschlossen.

**Änderungen:** $ALL_CHANGED
$TEST_RESULT

EOF
