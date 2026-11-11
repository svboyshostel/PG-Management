import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ID_TYPES, ID_TYPE_LABEL } from "@/lib/rules";

export type GuardianId = { guardianName: string; guardianRelation: string; guardianPhone: string; idMethod: string; idType: string; idNumber: string };
export const blankGuardianId: GuardianId = { guardianName: "", guardianRelation: "", guardianPhone: "", idMethod: "", idType: "", idNumber: "" };
const sel = "h-9 w-full rounded-md border bg-card px-2 text-sm";

/** Guardian contact + ID proof. Exactly one ID method: manual number, or image upload (upload needs file storage, not set up yet). */
export function GuardianIdFields({ v, set }: { v: GuardianId; set: (p: Partial<GuardianId>) => void }) {
  return (<>
    <div className="space-y-1.5"><Label>Guardian / parent name</Label><Input value={v.guardianName} onChange={(e) => set({ guardianName: e.target.value })} /></div>
    <div className="space-y-1.5"><Label>Relationship</Label>
      <select aria-label="Relationship" className={sel} value={v.guardianRelation} onChange={(e) => set({ guardianRelation: e.target.value })}>
        <option value="">Choose</option>{["Father", "Mother", "Guardian", "Spouse", "Sibling", "Other"].map((r) => <option key={r}>{r}</option>)}</select></div>
    <div className="space-y-1.5 sm:col-span-2"><Label>Guardian contact number</Label><Input inputMode="tel" value={v.guardianPhone} onChange={(e) => set({ guardianPhone: e.target.value })} /></div>
    <div className="space-y-1.5"><Label>ID proof method</Label>
      <select aria-label="ID proof method" className={sel} value={v.idMethod} onChange={(e) => set({ idMethod: e.target.value, idNumber: "" })}>
        <option value="">Not collected yet</option><option value="manual">Enter ID number</option><option value="upload" disabled={v.idMethod !== "upload"}>Private document (on resident page)</option></select></div>
    <div className="space-y-1.5"><Label>ID proof type</Label>
      <select aria-label="ID proof type" className={sel} value={v.idType} disabled={!v.idMethod} onChange={(e) => set({ idType: e.target.value, idNumber: "" })}>
        <option value="">Choose</option>{ID_TYPES.map((t) => <option key={t} value={t}>{ID_TYPE_LABEL[t]}</option>)}</select></div>
    {v.idMethod === "manual" && <div className="space-y-1.5 sm:col-span-2"><Label>ID number</Label>
      <Input value={v.idNumber} onChange={(e) => set({ idNumber: e.target.value })} placeholder={v.idType === "aadhaar" ? "12 digits — only the last 4 are saved" : ""} />
      {v.idType === "aadhaar" && <p className="text-xs text-muted-foreground">For privacy, Aadhaar is saved masked (XXXX XXXX 1234).</p>}</div>}
  </>);
}
