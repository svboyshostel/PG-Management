import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, Eye, Download, Trash2 } from "lucide-react";
import { listResidentDocuments, uploadResidentDocument, getResidentDocumentUrl, deleteResidentDocument } from "@/lib/documents.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ID_TYPES, ID_TYPE_LABEL } from "@/lib/rules";
import { validateDocumentFile } from "@/lib/documents";

export function ResidentDocuments({ residentId }: { residentId: string }) {
  const {data,error}=useQuery({queryKey:["documents",residentId],queryFn:()=>listResidentDocuments({data:{residentId}})});
  const cache=useQueryClient(), upload=useServerFn(uploadResidentDocument), link=useServerFn(getResidentDocumentUrl), remove=useServerFn(deleteResidentDocument);
  const [file,setFile]=useState<File|null>(null),[fileError,setFileError]=useState<string|null>(null),[type,setType]=useState<string>(""),[busy,setBusy]=useState(false);
  async function run(action:()=>Promise<unknown>) {setBusy(true);try{await action();await cache.invalidateQueries();}catch(e){toast.error(e instanceof Error?e.message:"Document action failed");}finally{setBusy(false);}}
  function handleFileChange(e:React.ChangeEvent<HTMLInputElement>){
    const picked=e.target.files?.[0]??null;
    if(!picked){setFile(null);setFileError(null);return;}
    try{validateDocumentFile(picked);setFile(picked);setFileError(null);}catch(err){const msg=err instanceof Error?err.message:"Invalid document.";setFile(null);setFileError(msg);toast.error(msg);e.target.value="";}
  }
  return <section className="mt-3 space-y-3 border-t pt-3">
    <h3 className="font-semibold">Private ID document</h3>
    {error&&<p className="text-sm text-destructive">{error.message}</p>}
    {data&&!data.configured&&<p className="text-sm text-warning">Private document storage needs configuring.</p>}
    {data&&!data.migrated&&<p className="text-sm text-warning">Document uploads need the prepared database update.</p>}
    {data?.legacyReference&&<p className="text-sm text-warning">An existing document reference is preserved. Complete its storage migration before replacing it.</p>}
    {data?.documents.map((d:any)=><div key={d.id} className="flex flex-wrap items-center gap-2 text-sm"><span className="min-w-0 flex-1 break-all">{d.file_name}{d.delete_pending_at&&<span className="ml-2 text-warning">Deletion pending · retry Delete</span>}</span>
      {[[false,Eye,"View document"],[true,Download,"Download document"]].map(([download,Icon,label])=>{const I=Icon as typeof Eye;return <Button key={String(label)} size="icon" variant="outline" title={String(label)} aria-label={String(label)} disabled={busy||!!d.delete_pending_at} onClick={()=>{const w=window.open("about:blank","_blank");if(w)w.opener=null;void run(async()=>{try{const r=await link({data:{id:d.id,download:!!download}});if(w)w.location.href=r.url;}catch(e){w?.close();throw e;}});}}><I className="h-4 w-4"/></Button>;})}
      <Button size="icon" variant="outline" title="Delete document" aria-label="Delete document" disabled={busy} onClick={()=>confirm("Delete this private ID document?")&&void run(()=>remove({data:{id:d.id}}))}><Trash2 className="h-4 w-4"/></Button></div>)}
    {data?.configured&&data.migrated&&!data.legacyReference&&!data.documents.length&&<div className="space-y-2">
      <select aria-label="Document ID type" className="h-9 w-full rounded-md border bg-card px-2 text-sm" value={type} onChange={e=>setType(e.target.value)}><option value="">ID type</option>{ID_TYPES.map(t=><option key={t} value={t}>{ID_TYPE_LABEL[t]}</option>)}</select>
      <Input aria-label="Private ID file" type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleFileChange}/>
      <p className="text-xs text-muted-foreground">JPEG, PNG or PDF · max 4 MB</p>
      {fileError&&<p role="alert" className="text-xs text-destructive">{fileError}</p>}
      <Button disabled={busy||!file||!type||!!fileError} onClick={()=>void run(async()=>{if(!file)return;validateDocumentFile(file);const form=new FormData();form.set("residentId",residentId);form.set("idType",type);form.set("file",file);await upload({data:form});setFile(null);setFileError(null);toast.success("Private document uploaded");})}><Upload className="h-4 w-4"/> Upload ID</Button>
    </div>}
  </section>;
}