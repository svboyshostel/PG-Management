// @vitest-environment node
import {it,expect,vi,beforeEach} from "vitest";
const f=vi.hoisted(()=>({deny:false,pending:false,failCompletion:false,objectDeleted:false,order:[] as string[]}));
vi.mock("@tanstack/react-start",()=>({createServerFn:()=>{let validate:(d:any)=>any=d=>d;const b={inputValidator:(v:(d:any)=>any)=>{validate=v;return b;},handler:(h:(v:any)=>unknown)=>async(v:any={})=>h({data:validate(v.data)})};return b;}}));
vi.mock("../lib/auth.server",()=>({requireUser:async()=>({id:"owner"})}));
vi.mock("../lib/access.server",()=>({requireEntityAccess:async()=>{if(f.deny)throw Error("Branch access denied");}}));
vi.mock("../lib/db.server",()=>({q:async(sql:string)=>{if(sql.includes("to_regclass"))return[{ok:true}];if(sql.includes("select * from resident_documents"))return[{id:"doc",resident_id:"resident",provider:"supabase",bucket:"private",object_key:"residents/resident/proof.pdf",file_name:"proof.pdf",delete_pending_at:f.pending?"now":null}];if(sql.includes("delete_pending_at=coalesce")){f.order.push("intent");f.pending=true;}return[];},tx:async()=>{f.order.push("completion");if(f.failCompletion)throw Error("Database unavailable");return[];}}));
vi.mock("../lib/storage.server",()=>({storageConfig:()=>({}),privateStorage:async()=>({bucket:"private",url:"https://storage.example.invalid"}),objectPath:()=>"/object",storageCall:async(_c:any,_p:string,init:any)=>{f.order.push(init.method);if(init.method==="DELETE")f.objectDeleted=true;return Response.json({signedURL:"/object/sign/private/proof.pdf?token=test"});}}));
import { PGlite } from "@electric-sql/pglite";
import { deleteResidentDocument, getResidentDocumentUrl, uploadResidentDocument } from "../lib/documents.functions";
import { DOCUMENT_MAX_BYTES } from "../lib/documents";
import { DOCUMENT_SCHEMA_STATEMENTS } from "../lib/documents-schema";
const id="00000000-0000-4000-8000-000000000001";
beforeEach(()=>{f.deny=false;f.pending=false;f.failCompletion=false;f.objectDeleted=false;f.order=[];});
it("cross-branch users cannot read or delete private documents",async()=>{f.deny=true;await expect(getResidentDocumentUrl({data:{id}})).rejects.toThrow("access denied");await expect(deleteResidentDocument({data:{id}})).rejects.toThrow("access denied");expect(f.order).toEqual([]);});
it("signed links are generated only after authorization",async()=>{const r=await getResidentDocumentUrl({data:{id,download:true}});expect(new URL(r.url).searchParams.get("download")).toBe("proof.pdf");expect(f.order).toEqual(["POST"]);});
it("storage deletion is durably scheduled before object removal and remains retryable after database failure",async()=>{f.failCompletion=true;await expect(deleteResidentDocument({data:{id}})).rejects.toThrow("Database unavailable");expect(f.order).toEqual(["intent","DELETE","completion"]);expect(f.pending).toBe(true);expect(f.objectDeleted).toBe(true);await expect(getResidentDocumentUrl({data:{id}})).rejects.toThrow("deletion is pending");f.failCompletion=false;await expect(deleteResidentDocument({data:{id}})).resolves.toEqual({ok:true});});
it("enforces the 4 MB upload limit on server before storage upload while allowing <= 4 MB files",async()=>{
  const tooLarge=new File([new Uint8Array(DOCUMENT_MAX_BYTES+1)],"big.jpg",{type:"image/jpeg"});
  const bigForm=new FormData();
  bigForm.set("residentId",id);
  bigForm.set("idType","aadhaar");
  bigForm.set("file",tooLarge);
  await expect(uploadResidentDocument({data:bigForm})).rejects.toThrow("4 MB");
  expect(f.order).toEqual([]);

  const validJpg=new File([new Uint8Array([255,216,255,224])],"id.jpg",{type:"image/jpeg"});
  const okForm=new FormData();
  okForm.set("residentId",id);
  okForm.set("idType","aadhaar");
  okForm.set("file",validJpg);
  await expect(uploadResidentDocument({data:okForm})).resolves.toHaveProperty("id");
  expect(f.order).toEqual(["POST","completion"]);
});
it("migrates legacy 5 MB resident_documents constraint safely while preserving existing >4 MB files",async()=>{
  const pg=new PGlite();
  await pg.exec(`
    create table app_users(id uuid primary key default gen_random_uuid());
    create table residents(id uuid primary key default gen_random_uuid());
    insert into residents(id) values('${id}');
    create table resident_documents (
      id uuid primary key default gen_random_uuid(),resident_id uuid not null references residents(id),
      provider text not null default 'supabase',bucket text not null,object_key text not null unique,
      file_name text not null,mime_type text not null,size_bytes int not null check(size_bytes between 1 and 5242880),
      created_by uuid references app_users(id),created_at timestamptz not null default now(),deleted_at timestamptz
    );
    insert into resident_documents(resident_id,bucket,object_key,file_name,mime_type,size_bytes)
      values('${id}','private','residents/${id}/legacy.pdf','legacy.pdf','application/pdf',4718592);
  `);
  for(const stmt of DOCUMENT_SCHEMA_STATEMENTS){await pg.exec(stmt);}
  const legacy=await pg.query<{size_bytes:number}>("select size_bytes from resident_documents where file_name='legacy.pdf'");
  expect(legacy.rows[0]?.size_bytes).toBe(4718592);
  await expect(pg.query("insert into resident_documents(resident_id,bucket,object_key,file_name,mime_type,size_bytes) values($1,'private','k-over','over.jpg','image/jpeg',$2)",[id,4194305])).rejects.toThrow();
  await expect(pg.query("insert into resident_documents(resident_id,bucket,object_key,file_name,mime_type,size_bytes) values($1,'private','k-ok','ok.jpg','image/jpeg',$2)",[id,4194304])).resolves.toBeDefined();
  await expect(pg.query("update resident_documents set delete_pending_at=now(), deleted_at=now() where file_name='legacy.pdf'")).resolves.toBeDefined();
  await pg.close();
});