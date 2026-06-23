#!/bin/zsh
# install-playwright.sh — Installiert Playwright E2E Tests
set -e
PROJECT="$HOME/dynamic-connection-planner"
cd "$PROJECT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Playwright — E2E Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "\n[1/3] Installiere @playwright/test..."
npm install --save-dev @playwright/test

echo "\n[2/3] Installiere Chromium Browser..."
npx playwright install chromium

echo "\n[3/3] Erstelle playwright.config.ts und ersten Test..."
cat > playwright.config.ts << 'TS'
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  webServer: {
    command: 'npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
TS

mkdir -p tests/e2e
cat > tests/e2e/canvas.spec.ts << 'TS'
import { test, expect } from '@playwright/test';

test('App lädt und zeigt Canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=Creator')).toBeVisible();
});

test('Management Tab öffnet', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Management');
  await expect(page.locator('text=Asset')).toBeVisible();
});
TS

echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Playwright installiert!"
echo "  Tests: tests/e2e/canvas.spec.ts"
echo "  Ausführen: npx playwright test"
echo "  Nächster Schritt (in Claude):"
echo "  → 'Schreibe Playwright Tests für Asset-Drag-Drop und Port-Verbindungen'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
