import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "./auth.server";
import { requireEntityAccess } from "./access.server";
import { q, tx } from "./db.server";
import { DOCUMENT_TYPES, validateDocument, validateDocumentFile } from "./documents";
import { privateStorage, storageCall, storageConfig, objectPath } from "./storage.server";
import { ID_TYPES } from "./rules";

const residentInput = z.object({ residentId: z.string().uuid() });
async function ready() {
  if (!(await q<{ ok: boolean }>("select to_regclass('public.resident_documents') is not null as ok"))[0]?.ok) throw new Error("Document uploads need the prepared database update. Ask the owner to apply it.");
}
export const listResidentDocuments = createServerFn({ method: "GET" }).inputValidator((d) => residentInput.parse(d)).handler(async ({ data }) => {
  const u = await requireUser(); await requireEntityAccess(u,"resident",data.residentId);
  const migrated = (await q<{ ok: boolean }>("select to_regclass('public.resident_documents') is not null as ok"))[0]?.ok;
  const documents = migrated ? await q<any>("select id,file_name,mime_type,size_bytes,provider,created_at,delete_pending_at from resident_documents where resident_id=$1 and deleted_at is null order by created_at desc",[data.residentId]) : [];
  const legacy = (await q<any>("select id_doc_key from residents where id=$1",[data.residentId]))[0]?.id_doc_key;
  const matched = migrated && legacy ? await q("select id from resident_documents where resident_id=$1 and object_key=$2 and deleted_at is null",[data.residentId,legacy]) : [];
  return { documents, configured: !!storageConfig(), migrated: !!migrated, legacyReference: !!legacy && !matched.length };
});
export const uploadResidentDocument = createServerFn({ method: "POST" }).inputValidator((d: FormData) => {
  if (!(d instanceof FormData)) throw new Error("Invalid upload."); return d;
}).handler(async ({ data }) => {
  const u = await requireUser();
  const residentId = z.string().uuid().parse(data.get("residentId"));
  await requireEntityAccess(u,"resident",residentId); await ready();
  const type = z.enum(ID_TYPES).parse(data.get("idType"));
  const file = data.get("file");
  if (!(file instanceof File)) throw new Error("Choose a JPEG, PNG or PDF up to 4 MB.");
  validateDocumentFile(file);
  const bytes = new Uint8Array(await file.arrayBuffer()); validateDocument(file.type,bytes);
  const existing = (await q<any>("select id_number,id_doc_key from residents where id=$1",[residentId]))[0];
  if (existing?.id_number || existing?.id_doc_key) throw new Error("Remove the existing ID proof before uploading a new document.");
  const c = await privateStorage(), id = crypto.randomUUID();
  const ext = DOCUMENT_TYPES[file.type as keyof typeof DOCUMENT_TYPES];
  const key = `residents/${residentId}/${id}.${ext}`;
  await storageCall(c,objectPath(c.bucket,key),{ method:"POST",headers:{"Content-Type":file.type,"x-upsert":"false"},body:file });
  try {
    await tx([{text:`insert into resident_documents(id,resident_id,bucket,object_key,file_name,mime_type,size_bytes,created_by) values($1,$2,$3,$4,$5,$6,$7,$8)`,params:[id,residentId,c.bucket,key,file.name.slice(0,150),file.type,file.size,u.id]},
      {text:`update residents set id_method='upload',id_type=$2,id_doc_key=$3,id_verification='pending' where id=$1 and id_number is null and id_doc_key is null`,params:[residentId,type,key]},
      // The exclusive resident pointer check rolls the transaction back if a concurrent upload won.
      {text:`select 1 / case when id_doc_key=$2 then 1 else 0 end from residents where id=$1`,params:[residentId,key]}]);
  } catch(e) {
    await storageCall(c,`/object/${encodeURIComponent(c.bucket)}`,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({prefixes:[key]})}).catch(()=>console.error("Unlinked document requires storage cleanup"));
    throw e;
  }
  return { id };
});
const docInput = z.object({ id:z.string().uuid(), download:z.boolean().optional() });
async function authorizedDocument(id:string, allowPendingDelete=false) {
  const u = await requireUser(); await ready();
  const row = (await q<any>("select * from resident_documents where id=$1 and deleted_at is null",[id]))[0];
  if (!row) throw new Error("Document not found."); await requireEntityAccess(u,"resident",row.resident_id);
  if (row.delete_pending_at && !allowPendingDelete) throw new Error("Document deletion is pending. Retry Delete to finish cleanup.");
  const c = await privateStorage();
  if (row.provider !== "supabase" || row.bucket !== c.bucket || !row.object_key.startsWith(`residents/${row.resident_id}/`)) throw new Error("Document belongs to a previous storage configuration. Its reference is preserved for migration.");
  return {row,c};
}
export const getResidentDocumentUrl = createServerFn({ method:"POST" }).inputValidator((d)=>docInput.parse(d)).handler(async({data})=>{
  const {row,c}=await authorizedDocument(data.id);
  const r=await (await storageCall(c,`/object/sign/${encodeURIComponent(c.bucket)}/${row.object_key.split('/').map(encodeURIComponent).join('/')}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({expiresIn:60})})).json() as {signedURL?:string};
  if (!r.signedURL) throw new Error("Storage did not provide a private link.");
  const url = new URL(`${c.url}/storage/v1${r.signedURL.startsWith("/") ? "" : "/"}${r.signedURL}`);
  if (url.origin!==c.url) throw new Error("Invalid storage link.");
  if(data.download)url.searchParams.set("download",row.file_name);
  return {url:url.toString()};
});
export const deleteResidentDocument = createServerFn({ method:"POST" }).inputValidator((d)=>z.object({id:z.string().uuid()}).parse(d)).handler(async({data})=>{
  const {row,c}=await authorizedDocument(data.id,true);
  // Persist intent first. A storage or completion failure remains discoverable and retryable.
  await q("update resident_documents set delete_pending_at=coalesce(delete_pending_at,now()) where id=$1 and deleted_at is null",[data.id]);
  await storageCall(c,`/object/${encodeURIComponent(c.bucket)}`,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({prefixes:[row.object_key]})});
  await tx([{text:"update resident_documents set deleted_at=now() where id=$1",params:[data.id]},
    {text:"update residents set id_doc_key=null,id_method=null,id_type=null,id_verification='pending' where id=$1 and id_doc_key=$2",params:[row.resident_id,row.object_key]}]);
  return {ok:true};
});