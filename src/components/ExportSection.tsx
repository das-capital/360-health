"use client";

import { useState } from "react";
import { csvFiles, download, loadBackup, toCsv, type Backup } from "@/lib/export";
import { logicalDate } from "@/lib/logical-date";

/** "Export my data": one complete JSON backup, or one CSV per table. */
export function ExportSection() {
  const [backup, setBackup] = useState<Backup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCsv, setShowCsv] = useState(false);

  // Read everything once, then reuse it for whichever file is asked for.
  const load = async (): Promise<Backup | null> => {
    if (backup) return backup;
    setBusy(true);
    setError(null);
    try {
      const fresh = await loadBackup();
      setBackup(fresh);
      return fresh;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  // Read the date only when a button is pressed, never while the page is being drawn.
  const stamp = () => logicalDate();

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="btn-primary w-full"
        disabled={busy}
        onClick={async () => {
          const data = await load();
          if (data) download(`360-health-backup-${stamp()}.json`, JSON.stringify(data, null, 2), "application/json");
        }}
      >
        {busy ? "Preparing…" : "Download everything (JSON)"}
      </button>
      <p className="text-sm text-neutral-500">
        One file with all your data. Keep a copy in Drive. Your Gemini key and notification settings for this phone are
        not included.
      </p>

      <button
        type="button"
        className="btn-secondary w-full"
        disabled={busy}
        onClick={async () => {
          if (await load()) setShowCsv(true);
        }}
      >
        Download as CSV (for spreadsheets)
      </button>

      {showCsv && backup && (
        <ul className="flex flex-col gap-2">
          {csvFiles(backup).map((file) => (
            <li key={file.name}>
              <button
                type="button"
                className="flex h-12 w-full items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-3 text-left active:bg-neutral-800 disabled:opacity-50"
                disabled={file.rows.length === 0}
                onClick={() => download(`360-health-${file.name}-${stamp()}.csv`, toCsv(file.rows), "text/csv")}
              >
                <span>{file.label}</span>
                <span className="text-sm text-neutral-500">
                  {file.rows.length === 0 ? "nothing yet" : `${file.rows.length} rows ↓`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-red-400">Could not export: {error}</p>}
    </div>
  );
}
