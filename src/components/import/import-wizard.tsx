"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PreviewTable } from "./preview-table";
import { parseFileAction, commitImportAction } from "@/app/import/actions";
import type { ParsedImport } from "@/lib/import/types";

type Step = "upload" | "preview" | "done";

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<ParsedImport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isParsing, startParse] = useTransition();
  const [isCommitting, startCommit] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) {
      setErrorMsg(null);
      setPreview(null);
      setStep("upload");
    }
  }

  function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setErrorMsg("Please select a file first"); return; }

    const fd = new FormData();
    fd.append("file", file);

    startParse(async () => {
      const result = await parseFileAction(fd);
      if ("error" in result) {
        setErrorMsg(result.error);
        return;
      }
      setPreview(result);
      setStep("preview");
    });
  }

  function handleCommit() {
    if (!preview) return;

    startCommit(async () => {
      const result = await commitImportAction({
        fileHash: preview.fileHash,
        filename: preview.filename,
        rows: preview.rows,
        stockBalanceKg: preview.stockBalanceKg,
      });

      if ("error" in result) {
        setErrorMsg(result.error);
        return;
      }

      router.push(`/import/${result.batchId}`);
    });
  }

  const validCount = preview?.summary.valid ?? 0;
  const skippedCount = preview?.summary.skipped ?? 0;
  const ambiguousCount = preview?.summary.ambiguousDates ?? 0;
  const canCommit = validCount > 0 && !preview?.alreadyImported;

  return (
    <div className="space-y-6">
      {/* Step 1 — file selector */}
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
        />
        <Button onClick={handleUpload} disabled={isParsing} size="sm">
          {isParsing ? "Parsing…" : "Parse"}
        </Button>
      </div>

      {errorMsg && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Step 2 — preview */}
      {step === "preview" && preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-gray-900">
                {preview.filename}
              </p>
              <p className="text-xs text-gray-500">
                {validCount} valid · {skippedCount > 0 ? `${skippedCount} skipped (errors) · ` : ""}{ambiguousCount > 0 ? `${ambiguousCount} ambiguous dates · ` : ""}{preview.summary.riceHusk} from "Rice Husk" · {preview.summary.partnership} from "partnership"
              </p>
            </div>

            <div className="flex items-center gap-2">
              {preview.alreadyImported && (
                <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                  Already imported
                </span>
              )}
              <Button
                onClick={handleCommit}
                disabled={!canCommit || isCommitting}
                size="sm"
              >
                {isCommitting ? "Importing…" : `Confirm import (${validCount} rows)`}
              </Button>
            </div>
          </div>

          {preview.alreadyImported && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              This file has already been imported. Re-importing is blocked to prevent double-counting.
            </div>
          )}

          <PreviewTable rows={preview.rows} />
        </div>
      )}
    </div>
  );
}
