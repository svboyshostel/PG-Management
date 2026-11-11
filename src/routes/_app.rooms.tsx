import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listRooms, listBranches, createRoom, updateBed, updateRoom, archiveRoom } from "@/lib/pg.functions";
import { inr, toPaise } from "@/lib/money";
import { MAX_SHARING } from "@/lib/rules";
import { RoomEb } from "@/components/app/room-eb";

const SHARING = Array.from({ length: MAX_SHARING }, (_, i) => i + 1);
import { PageHeader, Empty, useAction } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/rooms")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Rooms & beds — PG Manager" }, { name: "description", content: "Rooms, beds, rent per bed and occupancy." },
    { property: "og:title", content: "Rooms & beds — PG Manager" }, { property: "og:description", content: "Rooms, beds, rent per bed and occupancy." }] }),
  component: Rooms,
});

function Rooms() {
  const [branch, setBranch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [ebRoom, setEbRoom] = useState<any>(null);
  const { user } = Route.useRouteContext();
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => listBranches() });
  const { data, isLoading } = useQuery({ queryKey: ["rooms", branch], queryFn: () => listRooms({ data: { branchId: branch || undefined } }) });
  const active = (branches ?? []).filter((b: any) => b.is_active);
  if (branches && active.length === 0) return <Empty title="Add a branch first">Branches are managed in Settings.<Button asChild><Link to="/settings">Open settings</Link></Button></Empty>;
  return (
    <div>
      <PageHeader title="Rooms & beds" actions={<Button onClick={() => setOpen(true)}>Add room</Button>} />
      <select className="mb-4 h-9 rounded-md border bg-card px-2 text-sm" value={branch} onChange={(e) => setBranch(e.target.value)}>
        <option value="">All branches</option>{active.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      {isLoading ? <Skeleton className="h-64" /> : (data ?? []).length === 0 ? <Empty title="No rooms yet"><Button onClick={() => setOpen(true)}>Add a room</Button></Empty> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((r: any) => {
            const occ = r.beds.filter((b: any) => b.resident_id).length;
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div><div className="font-display text-lg font-semibold">Room {r.room_number}</div>
                    <div className="text-xs font-medium text-primary">{r.beds.length} sharing · {r.is_ac ? "AC" : "Non-AC"}</div>
                    <div className="text-xs text-muted-foreground">{r.branch_name}{r.floor && ` · floor ${r.floor}`}</div></div>
                  <div className="text-right text-sm"><b>{occ}/{r.beds.length}</b><div className="text-xs text-muted-foreground">{r.beds.length - occ} vacant</div></div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {r.beds.map((b: any) => <BedRow key={b.id} b={b} />)}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1"><AddBed roomId={r.id} />
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(r)}>Edit room</Button>
                  {user.role === "owner" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEbRoom(r)}>Electricity bill</Button>}
                  <ArchiveRoom room={r} occupied={occ} /></div>
              </Card>
            );
          })}
        </div>
      )}
      <NewRoom open={open} onOpenChange={setOpen} branches={active} />
      {editing && <EditRoom room={editing} onClose={() => setEditing(null)} />}
      {ebRoom && <RoomEb room={ebRoom} onClose={() => setEbRoom(null)} />}
    </div>
  );
}

function BedRow({ b }: { b: any }) {
  const [edit, setEdit] = useState(false);
  const [rent, setRent] = useState(String(Number(b.bed_rent) / 100));
  const m = useAction((v: any) => updateBed({ data: v }), "Saved", () => setEdit(false));
  return (
    <div className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${b.resident_id ? "bg-primary/10" : "bg-muted"}`}>
      <div><b>{b.label}</b> · {b.resident_id ? <Link to="/residents/$id" params={{ id: b.resident_id }} className="hover:underline">{b.resident_name}</Link> : <span className="text-muted-foreground">Vacant</span>}</div>
      {edit ? <div className="flex gap-1"><Input className="h-7 w-20" value={rent} onChange={(e) => setRent(e.target.value)} />
        <Button size="sm" className="h-7" onClick={() => m.mutate({ action: "rent", bedId: b.id, bedRent: toPaise(rent) })}>OK</Button></div>
        : <div className="flex items-center gap-1"><button className="text-xs underline-offset-2 hover:underline" onClick={() => setEdit(true)}>{inr(b.bed_rent)}</button>
          {!b.resident_id && <Button size="sm" variant="ghost" className="h-6 px-1 text-xs" onClick={() => confirm("Remove this vacant bed?") && m.mutate({ action: "remove", bedId: b.id })}>✕</Button>}</div>}
    </div>
  );
}

function AddBed({ roomId }: { roomId: string }) {
  const m = useAction((v: any) => updateBed({ data: v }), "Bed added");
  return <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { const r = prompt("Rent for new bed (₹)"); if (r) m.mutate({ action: "add", roomId, bedRent: toPaise(r) }); }}>+ Add bed</Button>;
}

function NewRoom({ open, onOpenChange, branches }: { open: boolean; onOpenChange: (v: boolean) => void; branches: any[] }) {
  const [f, setF] = useState({ branchId: "", roomNumber: "", floor: "", isAc: false, beds: "2", rent: "" });
  const m = useAction((v: any) => createRoom({ data: v }), "Room added", () => { onOpenChange(false); setF({ ...f, roomNumber: "" }); });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
      <DialogHeader><DialogTitle>Add room</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Branch</Label><select className="h-9 w-full rounded-md border bg-card px-2 text-sm" value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}>
          <option value="">Choose</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Room number</Label><Input value={f.roomNumber} onChange={(e) => setF({ ...f, roomNumber: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Floor</Label><Input value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Sharing (persons per room)</Label><select className="h-9 w-full rounded-md border bg-card px-2 text-sm" value={f.beds} onChange={(e) => setF({ ...f, beds: e.target.value })}>
            {SHARING.map((n) => <option key={n} value={n}>{n === 1 ? "Single" : `${n} sharing`}</option>)}</select></div>
          <div className="space-y-1.5"><Label>Rent per bed (₹)</Label><Input inputMode="decimal" value={f.rent} onChange={(e) => setF({ ...f, rent: e.target.value })} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.isAc} onCheckedChange={(v) => setF({ ...f, isAc: !!v })} /> AC room</label>
        <p className="text-xs text-muted-foreground">You can change each bed's rent afterwards.</p>
      </div>
      <DialogFooter><Button disabled={m.isPending} onClick={() => m.mutate({ branchId: f.branchId, roomNumber: f.roomNumber, floor: f.floor, isAc: f.isAc, beds: Number(f.beds), bedRent: toPaise(f.rent) })}>Add room</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}

function ArchiveRoom({ room, occupied }: { room: any; occupied: number }) {
  const m = useAction(() => archiveRoom({ data: { roomId: room.id } }), "Room archived");
  if (occupied > 0) return null;
  return <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => confirm(`Archive room ${room.room_number}? Its history is kept.`) && m.mutate(undefined as any)}>Archive</Button>;
}

function EditRoom({ room, onClose }: { room: any; onClose: () => void }) {
  const [f, setF] = useState({ roomNumber: room.room_number, floor: room.floor ?? "", isAc: !!room.is_ac, sharing: String(room.beds.length), sameRent: false, rent: room.beds[0] ? String(Number(room.beds[0].bed_rent) / 100) : "" });
  const occ = room.beds.filter((b: any) => b.resident_id).length;
  const m = useAction((v: any) => updateRoom({ data: v }), "Room saved", onClose);
  const grow = Number(f.sharing) > room.beds.length;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}><DialogContent>
      <DialogHeader><DialogTitle>Edit room {room.room_number}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Room number</Label><Input value={f.roomNumber} onChange={(e) => setF({ ...f, roomNumber: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Floor</Label><Input value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value })} /></div>
          <div className="space-y-1.5 col-span-2"><Label>Sharing</Label><select aria-label="Sharing" className="h-9 w-full rounded-md border bg-card px-2 text-sm" value={f.sharing} onChange={(e) => setF({ ...f, sharing: e.target.value })}>
            {SHARING.map((n) => <option key={n} value={n} disabled={n < occ}>{n === 1 ? "Single" : `${n} sharing`}{n < occ ? " (too few for current residents)" : ""}</option>)}</select>
            <p className="text-xs text-muted-foreground">{occ} of {room.beds.length} beds occupied. Reducing removes vacant beds only.</p></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.isAc} onCheckedChange={(v) => setF({ ...f, isAc: !!v })} /> AC room</label>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.sameRent} onCheckedChange={(v) => setF({ ...f, sameRent: !!v })} /> Apply the same rent to all beds</label>
        {(f.sameRent || grow) && <div className="space-y-1.5"><Label>{f.sameRent ? "Rent for every bed (₹)" : "Rent for new beds (₹)"}</Label><Input inputMode="decimal" value={f.rent} onChange={(e) => setF({ ...f, rent: e.target.value })} /></div>}
        <p className="text-xs text-muted-foreground">Current residents keep the rent they agreed to. New bed prices apply to future residents.</p>
      </div>
      <DialogFooter><Button disabled={m.isPending || !f.roomNumber} onClick={() => m.mutate({ roomId: room.id, roomNumber: f.roomNumber, floor: f.floor, isAc: f.isAc, sharing: Number(f.sharing),
        rentAll: f.sameRent ? toPaise(f.rent) : null, newBedRent: grow && f.rent ? toPaise(f.rent) : null })}>Save room</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}
