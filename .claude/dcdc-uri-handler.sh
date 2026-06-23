#!/bin/bash
# dcdc-uri-handler.sh
# Registered as handler for obsidian://implement-rule URIs via macOS URI scheme.
# Called with the full URI as $1, e.g.:
#   obsidian://implement-rule?vault=dcdc-vault&rule=DCDC%2FRules%2FRULE-001.md

URI="${1:-}"

# Extract query parameters from URI
RULE=$(echo "$URI" | sed 's/.*[?&]rule=//;s/&.*//' | python3 -c "import sys, urllib.parse; print(urllib.parse.unquote(sys.stdin.read().strip()))")

if [ -z "$RULE" ]; then
  osascript -e 'display notification "Missing rule parameter in URI" with title "DCDC: Error"'
  exit 1
fi

bash "$HOME/dynamic-connection-planner/.claude/implement-rule.sh" "$RULE"
