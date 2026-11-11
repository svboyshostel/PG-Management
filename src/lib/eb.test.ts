import { describe,it,expect } from "vitest";
import { calculateEb,reconcileEb,type Occupancy } from "./eb";
const stay=(resident_id:string,start_date="2026-11-01",end_date:string|null="2026-11-30"):Occupancy=>({id:resident_id,resident_id,name:resident_id,start_date,end_date,status:"active"});
describe("Room EB daily occupancy",()=>{
  it("November full-month four sharing allocates ₹500 each from ₹2000",()=>{expect(calculateEb("2026-11-01",200000,[stay("A"),stay("B"),stay("C"),stay("D")]).shares.map(s=>s.final)).toEqual([50000,50000,50000,50000]);});
  it("different joining dates give exact requested November amounts",()=>{const r=calculateEb("2026-11-01",200000,[stay("A"),stay("B"),stay("C","2026-11-10"),stay("D","2026-11-20")]);expect(r.shares.map(s=>s.final)).toEqual([70556,70556,40555,18333]);expect(r.shares.map(s=>s.days)).toEqual([30,30,21,11]);});
  it("checkout is inclusive and checked-out residents remain included",()=>{const r=calculateEb("2026-11-01",30000,[{...stay("A","2026-11-01","2026-11-10"),status:"checked_out"}]);expect(r.shares[0]).toMatchObject({days:10,final:10000,checkedOut:true});expect(r.ownerCalculated).toBe(20000);});
  it("all vacant days belong to owner",()=>{expect(calculateEb("2026-11-01",200000,[])).toMatchObject({shares:[],ownerCalculated:200000});});
  it("February leap-year uses 29 days",()=>{const r=calculateEb("2028-02-01",29000,[stay("A","2028-02-29","2028-02-29")]);expect(r.days).toBe(29);expect(r.shares[0]?.final).toBe(1000);expect(r.ownerCalculated).toBe(28000);});
  it("February nonleap and 31-day months",()=>{expect(calculateEb("2026-02-01",28000,[]).days).toBe(28);expect(calculateEb("2026-12-01",31000,[]).days).toBe(31);});
  it("same-room bed transfers do not double-count a resident",()=>{const r=calculateEb("2026-11-01",30000,[stay("A","2026-11-01","2026-11-15"),{...stay("A","2026-11-15","2026-11-30"),id:"second"}]);expect(r.shares[0]?.days).toBe(30);expect(r.shares[0]?.final).toBe(30000);});
  it("each transferred room has its own inclusive occupancy",()=>{expect(calculateEb("2026-11-01",30000,[stay("A","2026-11-01","2026-11-15")]).shares[0]?.final).toBe(15000);expect(calculateEb("2026-11-01",30000,[stay("A","2026-11-15","2026-11-30")]).shares[0]?.final).toBe(16000);});
  it("manual ₹600/500/500/400 adjustments are not redistributed",()=>{expect(reconcileEb(200000,[60000,50000,50000,40000].map(final=>({final})),false)).toEqual({allocated:200000,owner:0});});
  it("underallocation requires explicit owner acceptance",()=>{expect(()=>reconcileEb(200000,[{final:190000}],false)).toThrow("owner-borne");expect(reconcileEb(200000,[{final:190000}],true).owner).toBe(10000);});
  it("overallocation is refused even with owner acceptance",()=>{expect(()=>reconcileEb(200000,[{final:200001}],true)).toThrow("exceed");});
});