#!/bin/zsh
# Generiert den wöchentlichen DCDC Fortschritts-Report in Obsidian
# Wird jeden Donnerstag um 14:00 Uhr von Claude Code ausgeführt

VAULT="/Users/c5263507/Projects/dcdc-vault/DCDC"
API_KEY="62e91023c6c3426330d7b1e51c55f11efa23f033098c6a1885aed9954d2fb746"
API_BASE="http://localhost:27123"
PROJECT="/Users/c5263507/dynamic-connection-planner"

# KW und Datum ermitteln
KW=$(date +%V)
YEAR=$(date +%Y)
DATE_STR=$(date +"%d. %B %Y")
FILENAME="$YEAR-KW${KW}-Do.md"
NOTE_PATH="DCDC/Weekly-Reports/$FILENAME"

# Git-Log der letzten Woche holen
GIT_LOG=$(cd "$PROJECT" && git log --since="7 days ago" --oneline --no-merges 2>/dev/null || echo "Keine Git-Commits diese Woche")

# Anzahl Assets aus Vault zählen
ASSET_COUNT=$(find "$VAULT/Assets" -name "*.md" | wc -l | tr -d ' ')

# Vault-Notes zählen
NOTE_COUNT=$(find "$VAULT" -name "*.md" | wc -l | tr -d ' ')

# Report-Inhalt
CONTENT="# Weekly Report — KW${KW} | ${DATE_STR}

> Auto-generiert von Claude | Jeden Donnerstag ~14:00 Uhr
> Verweis: [[Milestones]] | [[Kanban]] | [[Session-KW${KW}]]

---

## 📊 Status-Übersicht

| Bereich | Status | Trend |
|---------|--------|-------|
| Milestone 1 | 🔵 In Bearbeitung | — |
| Development | 🔵 Aktiv | — |
| Dokumentation | 🟢 Aktuell | — |

---

## ✅ Git-Aktivität diese Woche

\`\`\`
${GIT_LOG}
\`\`\`

---

## 🔢 Metriken

| Metrik | Wert |
|--------|------|
| Assets in Bibliothek | ${ASSET_COUNT} |
| Vault Notes (gesamt) | ${NOTE_COUNT} |
| KW | ${KW} / 2026 |

---

## 🤖 KI-Analyse

> Diese Sektion wird von Claude in der nächsten Session ausgefüllt.
> Öffne eine neue Claude-Session und tippe: 'Analysiere den DCDC Fortschritt KW${KW}'

---

## 📅 Nächste Woche

- [ ] _Wird befüllt_

---

*Nächster Report: Donnerstag KW$(( KW + 1 ))*"

# Via REST API in Obsidian schreiben
curl -s -X PUT "$API_BASE/vault/$NOTE_PATH" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: text/markdown" \
  --data-raw "$CONTENT" > /dev/null

echo "✅ Weekly Report KW${KW} in Obsidian erstellt: $NOTE_PATH"

# Obsidian öffnen und Note anzeigen
ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$NOTE_PATH'))")
open "obsidian://open?vault=dcdc-vault&file=$ENCODED"
