import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eye, Download, Trash2, Camera, FolderOpen, X, FileText, Image as ImageIcon } from "lucide-react";
import {
  listResidentDocuments,
  uploadResidentDocument,
  getResidentDocumentUrl,
  deleteResidentDocument,
} from "@/lib/documents.functions";
import { Button } from "@/components/ui/button";
import { ID_TYPES, ID_TYPE_LABEL } from "@/lib/rules";
import { DOCUMENT_MAX_BYTES, DOCUMENT_INPUT_MAX_BYTES, DOCUMENT_TYPES, compressImageFile } from "@/lib/documents";

function validateUploadCandidate(file: { type: string; size: number }) {
  if (!(file.type in DOCUMENT_TYPES)) throw new Error("Choose a JPEG, PNG or PDF file.");
  if (file.type === "application/pdf") {
    if (!file.size || file.size > DOCUMENT_MAX_BYTES) throw new Error("Choose a JPEG, PNG or PDF up to 4 MB.");
  } else {
    if (!file.size || file.size > DOCUMENT_INPUT_MAX_BYTES) throw new Error("Choose a JPEG, PNG or PDF up to 5 MB.");
  }
}

export function ResidentDocuments({ residentId }: { residentId: string }) {
  const { data, error } = useQuery({
    queryKey: ["documents", residentId],
    queryFn: () => listResidentDocuments({ data: { residentId } }),
  });
  const cache = useQueryClient();
  const upload = useServerFn(uploadResidentDocument);
  const link = useServerFn(getResidentDocumentUrl);
  const remove = useServerFn(deleteResidentDocument);

  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [type, setType] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await cache.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Document action failed");
    } finally {
      setBusy(false);
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    if (!picked) {
      setFile(null);
      setFilePreview(null);
      setFileError(null);
      return;
    }
    try {
      validateUploadCandidate(picked);
      setFile(picked);
      setFileError(null);
      if (picked.type.startsWith("image/")) {
        setFilePreview(URL.createObjectURL(picked));
      } else {
        setFilePreview(null);
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "Invalid document.";
      setFile(null);
      setFilePreview(null);
      setFileError(msg);
      toast.error(msg);
      e.target.value = "";
    }
  }

  function clearSelectedFile() {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(null);
    setFilePreview(null);
    setFileError(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <section className="mt-3 space-y-3 border-t pt-3">
      <h3 className="font-semibold text-sm">Private ID document</h3>
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {data && !data.configured && <p className="text-sm text-warning">Private document storage needs configuring.</p>}
      {data && !data.migrated && <p className="text-sm text-warning">Document uploads need the prepared database update.</p>}
      {data?.legacyReference && (
        <p className="text-sm text-warning">
          An existing document reference is preserved. Complete its storage migration before replacing it.
        </p>
      )}

      {/* Uploaded Documents List with Preview */}
      {data?.documents.map((d: any) => (
        <div key={d.id} className="space-y-2 rounded-lg border bg-muted/10 p-3">
          <DocPreview doc={d} link={link} />
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="min-w-0 flex-1 break-all text-xs font-medium text-foreground">
              {d.file_name}
              {d.delete_pending_at && <span className="ml-2 text-warning">Deletion pending · retry Delete</span>}
            </span>
            <div className="flex items-center gap-1">
              {[
                [false, Eye, "View document"],
                [true, Download, "Download document"],
              ].map(([download, Icon, label]) => {
                const I = Icon as typeof Eye;
                return (
                  <Button
                    key={String(label)}
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    title={String(label)}
                    aria-label={String(label)}
                    disabled={busy || !!d.delete_pending_at}
                    onClick={() => {
                      const w = window.open("about:blank", "_blank");
                      if (w) w.opener = null;
                      void run(async () => {
                        try {
                          const r = await link({ data: { id: d.id, download: !!download } });
                          if (w) w.location.href = r.url;
                        } catch (e) {
                          w?.close();
                          throw e;
                        }
                      });
                    }}
                  >
                    <I className="h-4 w-4" />
                  </Button>
                );
              })}
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                title="Delete document"
                aria-label="Delete document"
                disabled={busy}
                onClick={() => confirm("Delete this private ID document?") && void run(() => remove({ data: { id: d.id } }))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}

      {/* Upload Form when no document is uploaded */}
      {data?.configured && data.migrated && !data.legacyReference && !data.documents.length && (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">ID Type</label>
            <select
              aria-label="Document ID type"
              className="h-9 w-full rounded-md border bg-card px-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">Choose ID type</option>
              {ID_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ID_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelected}
          />
          <input
            ref={fileInputRef}
            aria-label="Private ID file"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={handleFileSelected}
          />

          {!file ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" /> Take Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FolderOpen className="h-4 w-4" /> Choose File
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">JPEG, PNG or PDF · up to 5 MB (compressed automatically)</p>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-md border bg-card p-2 text-sm">
              <div className="flex items-center gap-3 overflow-hidden">
                {filePreview ? (
                  <img src={filePreview} alt="Preview" className="h-12 w-12 rounded object-cover border" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={clearSelectedFile}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {fileError && (
            <p role="alert" className="text-xs text-destructive">
              {fileError}
            </p>
          )}

          <Button
            disabled={busy || !file || !type || !!fileError}
            size="sm"
            onClick={() =>
              void run(async () => {
                if (!file) return;
                validateUploadCandidate(file);
                const prepared = await compressImageFile(file);
                const form = new FormData();
                form.set("residentId", residentId);
                form.set("idType", type);
                form.set("file", prepared);
                await upload({ data: form });
                clearSelectedFile();
                toast.success("Private document uploaded");
              })
            }
          >
            {busy ? "Uploading…" : "Upload ID"}
          </Button>
        </div>
      )}
    </section>
  );
}

function DocPreview({ doc, link }: { doc: any; link: any }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isImage = typeof doc.mime_type === "string" && doc.mime_type.startsWith("image/");

  useEffect(() => {
    let active = true;
    if (isImage) {
      setLoading(true);
      link({ data: { id: doc.id } })
        .then((r: any) => {
          if (active && r?.url) setUrl(r.url);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [doc.id, isImage]);

  if (!isImage) {
    return (
      <div className="flex items-center gap-3 rounded border bg-card p-2 text-sm">
        <FileText className="h-8 w-8 text-destructive" />
        <div>
          <p className="font-medium text-foreground">{doc.file_name}</p>
          <p className="text-xs text-muted-foreground">PDF Document · {(doc.size_bytes / 1024).toFixed(0)} KB</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-32 w-full animate-pulse items-center justify-center rounded border bg-muted/40">
        <span className="text-xs text-muted-foreground">Loading preview…</span>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex h-20 w-full items-center justify-center rounded border bg-muted/40">
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <img
        src={url}
        alt={doc.file_name}
        className="max-h-48 w-auto max-w-full rounded border bg-black/5 object-contain cursor-pointer shadow-sm transition hover:opacity-95"
        onClick={() => window.open(url, "_blank")}
        title="Click to view full image"
      />
      <p className="text-[11px] text-muted-foreground">Tap image to view full size</p>
    </div>
  );
}
