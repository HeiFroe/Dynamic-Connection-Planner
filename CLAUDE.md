# CLAUDE.md — Dynamic Connection Planner (DCDC)

## Project Overview

**Dynamic Connection Planner (DCDC)** ist eine React + TypeScript SPA zur visuellen Planung von AV/IT-Verbindungen in Konferenzräumen. Nutzer platzieren Hardware-Assets auf einem SVG-Canvas und verbinden Ports mit typisierten Kabeln.

- **App:** `~/dynamic-connection-planner`
- **Vault:** `~/Projects/dcdc-vault` (Obsidian MCP: `mcp__obsidian-dcdc`)
- **Stack:** React 18, TypeScript strict, Tailwind CSS, kein Backend

---

## Commands

```bash
npm start                        # Dev-Server http://localhost:3000
npm test                         # Watch mode
npm test -- --watchAll=false     # CI mode (vor jedem Commit)
npm run build                    # Production build
```

---

## Obsidian-Integration (PFLICHT)

Der Obsidian-Vault ist das Kommunikations- und Dokumentationszentrum.
**Heiko liest primär in Obsidian** — Terminal-Output reicht nicht.

### Vor jedem Task
1. `vault_read("DCDC/Project/Status.md")` — aktuellen Stand checken
2. `search_simple("TODO")` — offene Items prüfen

### Nach jedem Task
- `vault_patch` auf `DCDC/Project/Status.md` — "Zuletzt erledigt" und "In Arbeit" aktualisieren

### Kommunikation mit Heiko
Alle Nachrichten → `vault_patch` (append) auf `DCDC/Inbox/claude-messages.md`:

```
## YYYY-MM-DD HH:MM — [Betreff]
✅ DONE | ❓ QUESTION | ⚠️ BLOCKER | 📋 INFO

[Nachricht]
```

Prefixes:
- `✅ DONE:` Task abgeschlossen
- `❓ QUESTION:` Input von Heiko benötigt
- `⚠️ BLOCKER:` Blockiert — wartet auf Heiko
- `📋 INFO:` Hinweis, kein Handlungsbedarf

### Bug-Dokumentation
Bei jedem gefundenen Bug:
1. `vault_write("DCDC/Bugs/bug-YYYY-MM-DD-[slug].md", ...)` mit:
   - Symptom, Root Cause, Fix, Prevention
2. `vault_patch` (append) auf `DCDC/Bugs/INDEX.md` — Tabellenzeile hinzufügen

---

## Architektur (Kurzübersicht)

```
src/
├── App.tsx                     ← Shell: Creator + Management Tabs
├── components/
│   ├── creator/                ← Canvas, Assets, Connections, Controls
│   ├── management/             ← Asset-Verwaltung
│   └── ui/index.tsx            ← Primitives (Button, Card, Input, Select)
├── store/useAppStore.ts        ← EINZIGER State-Owner (useState + localStorage)
├── types/index.ts              ← Single Source of Truth für alle Types
├── utils/                      ← routing.ts, compatibility.ts, htmlExport.ts
├── config/micPodRules.ts       ← Logitech MicPod Verkettungsregeln
└── data/sampleAssets.ts        ← Default Asset-Bibliothek
```

**Kritische Regeln:**
- State-Mutations **nur** in `useAppStore.ts`
- Type-Änderungen in `types/index.ts` propagieren durch die gesamte App
- `Select`-Komponente rendert Options als immer-sichtbare Divs (kein Dropdown)
- `sampleAssets.ts` wird nur beim First-Run geladen — nie auto-injizieren

---

## Agent-Workflows

### Testing-Agent
Nach Komponenten-Änderungen:
```
1. npm test -- --watchAll=false ausführen
2. Ergebnis → vault_append "DCDC/Inbox/claude-messages.md"
3. Bei Fehlern → vault_write "DCDC/Bugs/bug-[datum]-[slug].md"
```

### Debugging-Agent
Bei unerwartetem Verhalten:
```
1. Bug dokumentieren in DCDC/Bugs/
2. Root Cause analysieren
3. Fix anwenden
4. Test ausführen
5. Ergebnis in Inbox melden
```

### UI-Verification
Nach UI-Änderungen:
- Dev-Server starten (`npm start`)
- Chrome DevTools MCP / Playwright für Browser-Test nutzen
- Screenshot oder Snapshot als Beweis in Inbox-Nachricht erwähnen

---

## Key Constraints

- TypeScript strict — kein `any`, keine suppressierten Errors
- Kein Backend — alles clientseitig in localStorage
- Keine neuen Abstraktionen ohne konkreten Bedarf
- Keine Kommentare außer für nicht-offensichtliche WHY-Gründe
- Canvas ist custom SVG (kein React Flow / Konva) — Routing-Algorithmus in `routing.ts`

---

## Vault-Struktur Referenz

```
DCDC/
├── 00-Index.md              ← Navigation
├── Inbox/claude-messages.md ← Claude → Heiko Kommunikation
├── Project/Status.md        ← Aktueller Projektstatus
├── Bugs/                    ← Bug-Reports + INDEX.md
├── Development/
│   ├── Architecture.md      ← Vollständige Architektur-Doku
│   ├── Changelog.md         ← Versionshistorie
│   └── Features/            ← Feature-Planung
├── AI-Sessions/             ← KI-Analyse Sessions
├── Roadmap/                 ← Milestones, Kanban, Sprints
├── Documentation/           ← Field Support Anleitungen
├── Assets/                  ← Asset-Index
└── Weekly-Reports/          ← Donnerstags automatisch generiert
```
