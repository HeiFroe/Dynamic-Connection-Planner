#!/bin/zsh
# install-pdf-export.sh — Installiert jspdf + html2canvas
set -e
PROJECT="$HOME/dynamic-connection-planner"
cd "$PROJECT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PDF Export (jspdf + html2canvas)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "\n[1/3] Installiere jspdf + html2canvas..."
npm install jspdf html2canvas
npm install --save-dev @types/html2canvas 2>/dev/null || true

echo "\n[2/3] Füge exportToPDF Funktion zu src/utils/htmlExport.ts hinzu..."
cat >> src/utils/htmlExport.ts << 'TS'

// ── PDF Export ────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function exportToPDF(canvasElement: HTMLElement, planName: string): Promise<void> {
  const canvas = await html2canvas(canvasElement, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = (canvas.height * pageW) / canvas.width;
  pdf.addImage(imgData, 'PNG', 0, 0, pageW, pageH);
  const filename = `${planName.replace(/[^a-z0-9]/gi, '-')}_${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(filename);
}
TS

echo "\n[3/3] TypeScript-Check..."
npx tsc --noEmit 2>&1 | head -10 || true

echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ PDF Export bereit!"
echo "  Nächster Schritt (in Claude):"
echo "  → 'Füge PDF Export Button zur Creator Toolbar hinzu'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
