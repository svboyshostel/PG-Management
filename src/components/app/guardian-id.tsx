import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ID_TYPES, ID_TYPE_LABEL } from "@/lib/rules";

export type GuardianId = { guardianName: string; guardianRelation: string; guardianPhone: string; idMethod: string; idType: string; idNumber: string };
export const blankGuardianId: GuardianId = { guardianName: "", guardianRelation: "", guardianPhone: "", idMethod: "", idType: "", idNumber: "" };
const sel = "h-9 w-full rounded-md border bg-card px-2 text-sm";

/** Guardian contact + ID proof. Select ID type directly, with optional ID number and document upload. */
export function GuardianIdFields({ v, set }: { v: GuardianId; set: (p: Partial<GuardianId>) => void }) {
  return (<>
    <div className="space-y-1.5"><Label>Guardian / parent name</Label><Input value={v.guardianName} onChange={(e) => set({ guardianName: e.target.value })} /></div>
    <div className="space-y-1.5"><Label>Relationship</Label>
      <select aria-label="Relationship" className={sel} value={v.guardianRelation} onChange={(e) => set({ guardianRelation: e.target.value })}>
        <option value="">Choose</option>{["Father", "Mother", "Guardian", "Spouse", "Sibling", "Other"].map((r) => <option key={r}>{r}</option>)}</select></div>
    <div className="space-y-1.5 sm:col-span-2"><Label>Guardian contact number</Label><Input inputMode="tel" value={v.guardianPhone} onChange={(e) => set({ guardianPhone: e.target.value })} /></div>
    <div className="space-y-1.5 sm:col-span-2"><Label>ID proof type</Label>
      <select aria-label="ID proof type" className={sel} value={v.idType} onChange={(e) => {
        const type = e.target.value;
        set({ idType: type, idMethod: type ? (v.idMethod || "manual") : "", idNumber: type ? v.idNumber : "" });
      }}>
        <option value="">Not collected yet</option>{ID_TYPES.map((t) => <option key={t} value={t}>{ID_TYPE_LABEL[t]}</option>)}</select></div>
    {!!v.idType && <div className="space-y-1.5 sm:col-span-2"><Label>ID number (optional)</Label>
      <Input value={v.idNumber} onChange={(e) => set({ idNumber: e.target.value, idMethod: v.idMethod || "manual" })} placeholder={v.idType === "aadhaar" ? "12 digits — optional, only the last 4 are saved" : "Optional ID number"} />
      {v.idType === "aadhaar" && <p className="text-xs text-muted-foreground">For privacy, Aadhaar is saved masked (XXXX XXXX 1234).</p>}</div>}
  </>);
}
