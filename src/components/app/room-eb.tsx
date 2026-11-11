import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { previewRoomEb, getRoomEb, saveRoomEb, finalizeRoomEb, reconcileEbLiability } from "@/lib/eb.functions";
import type { EbShare } from "@/lib/eb";
import { inr, monthStart, toPaise } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function RoomEb({ room, onClose }: { room: { id: string; room_number: string; branch_name: string }; onClose: () => void }) {
  const [month,setMonth]=useState(monthStart().slice(0,7)),[amount,setAmount]=useState(""),[shares,setShares]=useState<EbShare[]|null>(null),[version,setVersion]=useState(0),[owner,setOwner]=useState(false),[busy,setBusy]=useState(false);
  const [edits,setEdits]=useState<Record<string,string>>({});
  const {data,error}=useQuery({queryKey:["room-eb",room.id,month],queryFn:()=>getRoomEb({data:{roomId:room.id,month:month+"-01"}})});
  const cache=useQueryClient(),preview=useServerFn(previewRoomEb),save=useServerFn(saveRoomEb),finalize=useServerFn(finalizeRoomEb),resolve=useServerFn(reconcileEbLiability);
  useEffect(()=>{const b=data?.bill;setAmount(b?String(Number(b.total)/100):"");setShares(b?.shares??null);setVersion(b?.version??0);setOwner(!!b?.owner_accepted);setEdits({});},[data]);
  const total=toPaise(amount),locked=data?.bill?.status==="finalized";
  const finalShares=shares?.map(s=>({...s,final:edits[s.residentId]===undefined?s.final:toPaise(edits[s.residentId]??"")}))??[];
  const allocated=finalShares.reduce((a,s)=>a+(Number.isFinite(s.final)?s.final:0),0),difference=total-allocated;
  async function run(action:()=>Promise<unknown>){setBusy(true);try{await action();}catch(e){toast.error(e instanceof Error?e.message:"Electricity billing failed");}finally{setBusy(false);}}
  async function persist(finish:boolean){
    const draft=await save({data:{roomId:room.id,month:month+"-01",total,version,ownerAccepted:owner,shares:finalShares.map(s=>({residentId:s.residentId,final:s.final}))}});
    setVersion(draft.version);
    if(finish)await finalize({data:{id:draft.id,version:draft.version}});
    await cache.invalidateQueries();toast.success(finish?"Electricity bill finalized":"Draft saved");
  }
  return <Dialog open onOpenChange={v=>!v&&onClose()}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
    <DialogHeader><DialogTitle>Room {room.room_number} · Electricity bill</DialogTitle><p className="text-sm text-muted-foreground">{room.branch_name} · {locked?"Finalized":"Draft"}</p></DialogHeader>
    <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Billing month</Label><Input aria-label="EB billing month" type="month" value={month} onChange={e=>{setMonth(e.target.value);setShares(null);setVersion(0);}}/></div>
      <div className="space-y-1"><Label>Total room EB (₹)</Label><Input aria-label="Total room EB" inputMode="decimal" disabled={locked} value={amount} onChange={e=>{setAmount(e.target.value);setShares(null);setEdits({});}}/></div></div>
    {error&&<p role="alert" className="text-sm text-warning">{error.message}</p>}
    {!locked&&<Button disabled={busy||!month||!Number.isSafeInteger(total)||total<0||!amount} onClick={()=>void run(async()=>{const r=await preview({data:{roomId:room.id,month:month+"-01",total}});setShares(r.shares);setEdits({});setOwner(false);})}>Calculate EB</Button>}
    {shares&&<><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted text-left"><tr>{["Resident","Days","Calculated EB","Final EB (₹)","Difference"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead>
      <tbody className="divide-y">{finalShares.map(s=><tr key={s.residentId}><td className="p-2">{s.name}{s.checkedOut&&<div className="text-xs text-warning">Checked out · separate reconciliation</div>}</td><td className="p-2">{s.days}</td><td className="p-2">{inr(s.calculated)}</td><td className="p-2"><Input className="min-w-24" aria-label={`Final EB for ${s.name}`} disabled={locked} inputMode="decimal" value={edits[s.residentId]??String(s.final/100)} onChange={e=>setEdits({...edits,[s.residentId]:e.target.value})}/></td><td className="p-2">{inr(s.final-s.calculated)}</td></tr>)}</tbody></table></div>
      <div className="space-y-1 border-t pt-3 text-sm"><div className="flex justify-between"><span>Total allocated</span><b>{inr(allocated)}</b></div><div className="flex justify-between"><span>Unallocated / owner-borne</span><b className={difference<0?"text-destructive":""}>{inr(difference)}</b></div></div>
      {!locked&&difference!==0&&<p className="text-sm text-warning">{difference<0?"Resident charges exceed the total bill. Reconcile before finalizing.":"Unallocated electricity, including vacant days, must be borne by the owner."}</p>}
      {!locked&&difference>0&&<label className="flex items-start gap-2 text-sm"><Checkbox checked={owner} onCheckedChange={v=>setOwner(!!v)}/>I accept {inr(difference)} as owner-borne.</label>}
      {!locked&&<div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy||!!error} onClick={()=>void run(()=>persist(false))}>Save Draft</Button><Button disabled={busy||!!error||difference<0||(difference>0&&!owner)} onClick={()=>confirm("Finalize electricity charges? Finalized bills cannot be edited. Checked-out residents will have separate pending liabilities.")&&void run(()=>persist(true))}>Finalize</Button></div>}
    </>}
    {!!data?.liabilities.length&&<section className="space-y-2 border-t pt-3"><h3 className="font-semibold">Resident liabilities</h3>{data.liabilities.map((l:any)=><div key={l.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{l.name} · {inr(l.amount)} · {l.state==="pending"?"Pending checkout reconciliation":l.state.replace("_"," ")}</span>{l.state==="pending"&&<div className="flex gap-2">{["post","owner_borne"].map(action=><Button key={action} size="sm" variant="outline" disabled={busy} onClick={()=>{const reason=prompt(action==="post"?"Reason for a new post-checkout charge (completed settlement stays unchanged)":"Reason for owner bearing this liability");if(reason)void run(async()=>{await resolve({data:{id:l.id,action:action as "post"|"owner_borne",reason}});await cache.invalidateQueries();});}}>{action==="post"?"Record new charge":"Owner bears"}</Button>)}</div>}</div>)}</section>}
    {!!data?.history.length&&<section className="border-t pt-3"><h3 className="mb-2 font-semibold">Room EB history</h3>{data.history.map((b:any)=><Button key={b.id} variant="ghost" size="sm" onClick={()=>setMonth(b.billing_month.slice(0,7))}>{b.billing_month.slice(0,7)} · {b.status} · {inr(b.total)}</Button>)}</section>}
  </DialogContent></Dialog>;
}