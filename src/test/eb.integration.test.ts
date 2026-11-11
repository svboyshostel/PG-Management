// @vitest-environment node
import {PGlite} from "@electric-sql/pglite";
import {beforeAll,afterAll,it,expect,vi} from "vitest";
import {SCHEMA_STATEMENTS} from "../lib/schema";
import type {SessionUser} from "../lib/auth.server";
const fixture=vi.hoisted(()=>({db:null as PGlite|null,user:null as SessionUser|null}));
vi.mock("@tanstack/react-start",()=>({createServerFn:()=>{let validate:(d:any)=>any=(d)=>d;const b={inputValidator:(v:(d:any)=>any)=>{validate=v;return b;},handler:(h:(v:any)=>unknown)=>async(v:any={})=>h({data:validate(v.data)})};return b;}}));
vi.mock("../lib/db.server",()=>({q:async(s:string,p:unknown[]=[])=>{if(!fixture.db)throw Error("fixture");return(await fixture.db.query(s,p)).rows;},tx:async(stmts:{text:string;params?:unknown[]}[])=>{if(!fixture.db)throw Error("fixture");return fixture.db.transaction(async db=>{const out=[];for(const s of stmts)out.push((await db.query(s.text,s.params)).rows);return out;});}}));
vi.mock("../lib/auth.server",()=>({requireOwner:async()=>{if(fixture.user?.role!=="owner")throw Error("Only the owner");return fixture.user;}}));
import {previewRoomEb,saveRoomEb,finalizeRoomEb,getRoomEb,reconcileEbLiability} from "../lib/eb.functions";
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const owner:SessionUser={id:id(1),role:"owner",email:"test@example.invalid",full_name:"Test",can_reverse:true,can_message:true,branch_ids:[]};
const query=async(s:string,p:unknown[]=[])=>{if(!fixture.db)throw Error("fixture");return(await fixture.db.query<any>(s,p)).rows;};
beforeAll(async()=>{fixture.db=new PGlite();for(const s of SCHEMA_STATEMENTS)if(!s.startsWith("create extension"))await fixture.db.exec(s);fixture.user=owner;
await query("insert into app_users(id,email,full_name,password_hash,role) values($1,'test@example.invalid','Test','x','owner')",[id(1)]);
await query("insert into branches(id,name) values($1,'Branch')",[id(2)]);
await query("insert into rooms(id,branch_id,room_number) values($1,$2,'102')",[id(3),id(2)]);
for(let n=0;n<4;n++){await query("insert into beds(id,room_id,label,bed_rent) values($1,$2,$3,500000)",[id(10+n),id(3),String(n)]);await query("insert into residents(id,name,mobile,branch_id,joining_date) values($1,$2,'9876543210',$3,'2026-11-01')",[id(20+n),`Resident ${n}`,id(2)]);await query("insert into allocations(resident_id,bed_id,start_date,monthly_rent) values($1,$2,'2026-11-01',500000)",[id(20+n),id(10+n)]);}
},60000);
afterAll(async()=>{await fixture.db?.close();});
it("draft saves write no ledger; edits are version guarded and finalization posts exactly once",async()=>{
const p=await previewRoomEb({data:{roomId:id(3),month:"2026-11-01",total:200000}});
const input={roomId:id(3),month:"2026-11-01",total:200000,version:0,shares:p.shares,ownerAccepted:false};
const d=await saveRoomEb({data:input});expect((await query("select count(*) n from bill_lines"))[0].n).toBe(0);
const updated=await saveRoomEb({data:{...input,version:d.version,shares:p.shares.map((s,i)=>({...s,final:[60000,50000,50000,40000][i]??0}))}});
await expect(saveRoomEb({data:{...input,version:d.version}})).rejects.toThrow("changed");
await finalizeRoomEb({data:updated});await finalizeRoomEb({data:updated});
const totals=(await query("select sum(amount) total,count(*) n from bill_lines"))[0];expect(Number(totals.total)).toBe(200000);expect(totals.n).toBe(4);
await expect(saveRoomEb({data:{...input,version:updated.version}})).rejects.toThrow();
await expect(query("update room_eb_bills set total=1 where id=$1",[d.id])).rejects.toThrow("immutable");
});
it("changed historical occupancy invalidates a saved draft",async()=>{
const p=await previewRoomEb({data:{roomId:id(3),month:"2026-10-01",total:10000}});const d=await saveRoomEb({data:{roomId:id(3),month:"2026-10-01",total:10000,version:0,shares:p.shares,ownerAccepted:true}});
await query("update allocations set start_date='2026-10-30' where resident_id=$1",[id(20)]);
await expect(finalizeRoomEb({data:d})).rejects.toThrow("Occupancy changed");
});
it("checked-out liability does not alter settlement and is reconciled with a new charge only once",async()=>{
await query("update residents set status='checked_out',checkout_date='2026-11-30' where id=$1",[id(20)]);await query("update allocations set end_date='2026-11-30' where resident_id=$1",[id(20)]);
const p=await previewRoomEb({data:{roomId:id(3),month:"2026-12-01",total:200000}});
// Use November in a second room to represent late EB received after checkout.
await query("insert into rooms(id,branch_id,room_number) values($1,$2,'103')",[id(4),id(2)]);await query("insert into beds(id,room_id,label,bed_rent) values($1,$2,'X',1)",[id(14),id(4)]);await query("insert into allocations(resident_id,bed_id,start_date,end_date,monthly_rent) values($1,$2,'2026-10-01','2026-10-31',1)",[id(20),id(14)]);
const cp=await previewRoomEb({data:{roomId:id(4),month:"2026-10-01",total:10000}});const d=await saveRoomEb({data:{roomId:id(4),month:"2026-10-01",total:10000,version:0,shares:cp.shares,ownerAccepted:false}});
const before=(await query("select count(*) n from bill_lines"))[0].n;await finalizeRoomEb({data:d});expect((await query("select count(*) n from bill_lines"))[0].n).toBe(before);
const details=await getRoomEb({data:{roomId:id(4),month:"2026-10-01"}});const liability=details.liabilities[0];expect(liability.state).toBe("pending");
await reconcileEbLiability({data:{id:liability.id,action:"post",reason:"Owner approved late electricity liability"}});await reconcileEbLiability({data:{id:liability.id,action:"post",reason:"Repeated same approval"}});
expect((await query("select count(*) n from bill_lines where description='Post-checkout EB adjustment'"))[0].n).toBe(1);expect((await query("select count(*) n from money_txns"))[0].n).toBe(0);expect(p.shares.length).toBe(3);
});
it("staff cannot calculate or finalize owner-only electricity bills",async()=>{fixture.user={...owner,role:"staff"};await expect(previewRoomEb({data:{roomId:id(3),month:"2026-11-01",total:1}})).rejects.toThrow("owner");});