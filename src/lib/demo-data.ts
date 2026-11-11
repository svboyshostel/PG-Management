import { calculateEb, type Occupancy } from "./eb";
import { renderTemplate } from "./wa";

export interface DemoBranch {
  id: string;
  name: string;
  city: string;
  rooms: number;
  occupiedBeds: number;
  totalBeds: number;
}

export interface DemoRoom {
  id: string;
  branchId: string;
  branchName: string;
  number: string;
  floor: string;
  sharing: number;
  occupied: number;
  monthlyRentPaise: number;
  occupants: string[];
}

export interface DemoResident {
  id: string;
  branchId: string;
  branchName: string;
  name: string;
  phoneMasked: string;
  roomNumber: string;
  bedLabel: string;
  status: "active" | "checked_out";
  joiningDate: string;
  checkoutDate: string | null;
  monthlyRentPaise: number;
  depositHeldPaise: number;
  depositTargetPaise: number;
  outstandingPaise: number;
  idMethod: "manual" | "upload";
  idTypeLabel: string;
  idSummary: string;
  idVerification: "verified" | "pending";
  lastPaymentNote: string;
}

export interface DemoPayment {
  id: string;
  date: string;
  residentName: string;
  branchId: string;
  branchName: string;
  roomNumber: string;
  account: "rent" | "deposit";
  method: "UPI" | "Cash" | "Bank Transfer";
  amountPaise: number;
  reference: string;
}

export interface DemoEbBill {
  id: string;
  branchId: string;
  branchName: string;
  roomNumber: string;
  month: string;
  monthLabel: string;
  status: "finalized" | "draft";
  totalPaise: number;
  meterReading: string;
  daysInMonth: number;
  ownerPaise: number;
  shares: ReturnType<typeof calculateEb>["shares"];
}

export const DEMO_PG_NAME = "Sunrise Residency (Demo Preview)";
export const DEMO_BILLING_MONTH = "2026-11-01";

export const DEMO_BRANCHES: DemoBranch[] = [
  { id: "br-main", name: "Koramangala Main (Sample)", city: "Bengaluru", rooms: 3, occupiedBeds: 8, totalBeds: 9 },
  { id: "br-annex", name: "HSR Annex (Sample)", city: "Bengaluru", rooms: 2, occupiedBeds: 3, totalBeds: 3 },
];

export const DEMO_ROOMS: DemoRoom[] = [
  { id: "rm-101", branchId: "br-main", branchName: "Koramangala Main (Sample)", number: "101", floor: "1st", sharing: 4, occupied: 4, monthlyRentPaise: 850000, occupants: ["Aarav Sharma", "Karthik Reddy", "Rohan Verma", "Devansh Patel"] },
  { id: "rm-102", branchId: "br-main", branchName: "Koramangala Main (Sample)", number: "102", floor: "1st", sharing: 2, occupied: 1, monthlyRentPaise: 1100000, occupants: ["Priya Nair"] },
  { id: "rm-201", branchId: "br-main", branchName: "Koramangala Main (Sample)", number: "201", floor: "2nd", sharing: 3, occupied: 3, monthlyRentPaise: 950000, occupants: ["Sneha Kulkarni", "Meera Iyer", "Ananya Rao"] },
  { id: "rm-a101", branchId: "br-annex", branchName: "HSR Annex (Sample)", number: "A-101", floor: "1st", sharing: 2, occupied: 2, monthlyRentPaise: 1150000, occupants: ["Siddharth Menon", "Nikhil Joshi"] },
  { id: "rm-a102", branchId: "br-annex", branchName: "HSR Annex (Sample)", number: "A-102", floor: "1st", sharing: 1, occupied: 1, monthlyRentPaise: 1550000, occupants: ["Kavya Krishnan"] },
];

export const DEMO_RESIDENTS: DemoResident[] = [
  {
    id: "res-1",
    branchId: "br-main",
    branchName: "Koramangala Main (Sample)",
    name: "Aarav Sharma",
    phoneMasked: "+91 98XXX XX210",
    roomNumber: "101",
    bedLabel: "Bed A",
    status: "active",
    joiningDate: "2026-07-01",
    checkoutDate: null,
    monthlyRentPaise: 850000,
    depositHeldPaise: 1500000,
    depositTargetPaise: 1500000,
    outstandingPaise: 0,
    idMethod: "manual",
    idTypeLabel: "Aadhaar",
    idSummary: "XXXX XXXX 4821",
    idVerification: "verified",
    lastPaymentNote: "Paid ₹9,205 on 03 Nov 2026 via UPI (Rent + Oct EB)",
  },
  {
    id: "res-2",
    branchId: "br-main",
    branchName: "Koramangala Main (Sample)",
    name: "Karthik Reddy",
    phoneMasked: "+91 97XXX XX441",
    roomNumber: "101",
    bedLabel: "Bed B",
    status: "active",
    joiningDate: "2026-09-01",
    checkoutDate: null,
    monthlyRentPaise: 850000,
    depositHeldPaise: 1500000,
    depositTargetPaise: 1500000,
    outstandingPaise: 70556,
    idMethod: "upload",
    idTypeLabel: "PAN",
    idSummary: "Private document uploaded (preview)",
    idVerification: "verified",
    lastPaymentNote: "Rent ₹8,500 paid on 05 Nov 2026; EB ₹705.56 pending",
  },
  {
    id: "res-3",
    branchId: "br-main",
    branchName: "Koramangala Main (Sample)",
    name: "Rohan Verma",
    phoneMasked: "+91 99XXX XX812",
    roomNumber: "101",
    bedLabel: "Bed C",
    status: "active",
    joiningDate: "2026-11-10",
    checkoutDate: null,
    monthlyRentPaise: 850000,
    depositHeldPaise: 1000000,
    depositTargetPaise: 1500000,
    outstandingPaise: 623888,
    idMethod: "upload",
    idTypeLabel: "Driving licence",
    idSummary: "Private document uploaded (preview)",
    idVerification: "pending",
    lastPaymentNote: "₹5,000 joining part-payment on 10 Nov 2026; ₹5,000 deposit + ₹405.55 EB due",
  },
  {
    id: "res-4",
    branchId: "br-main",
    branchName: "Koramangala Main (Sample)",
    name: "Priya Nair",
    phoneMasked: "+91 96XXX XX109",
    roomNumber: "102",
    bedLabel: "Bed A",
    status: "active",
    joiningDate: "2026-05-01",
    checkoutDate: null,
    monthlyRentPaise: 1100000,
    depositHeldPaise: 2000000,
    depositTargetPaise: 2000000,
    outstandingPaise: 0,
    idMethod: "manual",
    idTypeLabel: "Passport",
    idSummary: "XXXX 7742",
    idVerification: "verified",
    lastPaymentNote: "Paid ₹11,000 on 02 Nov 2026 via Bank Transfer",
  },
  {
    id: "res-5",
    branchId: "br-main",
    branchName: "Koramangala Main (Sample)",
    name: "Vikram Joshi (Checked out)",
    phoneMasked: "+91 95XXX XX903",
    roomNumber: "102",
    bedLabel: "Bed B",
    status: "checked_out",
    joiningDate: "2026-04-01",
    checkoutDate: "2026-11-10",
    monthlyRentPaise: 1100000,
    depositHeldPaise: 0,
    depositTargetPaise: 2000000,
    outstandingPaise: 80000,
    idMethod: "manual",
    idTypeLabel: "Voter ID",
    idSummary: "XXXX 3319",
    idVerification: "verified",
    lastPaymentNote: "Post-checkout Nov EB liability ₹800 awaiting settlement",
  },
  {
    id: "res-6",
    branchId: "br-annex",
    branchName: "HSR Annex (Sample)",
    name: "Siddharth Menon",
    phoneMasked: "+91 94XXX XX651",
    roomNumber: "A-101",
    bedLabel: "Bed A",
    status: "active",
    joiningDate: "2026-08-01",
    checkoutDate: null,
    monthlyRentPaise: 1150000,
    depositHeldPaise: 2200000,
    depositTargetPaise: 2200000,
    outstandingPaise: 1232500,
    idMethod: "upload",
    idTypeLabel: "Aadhaar",
    idSummary: "Private document uploaded (preview)",
    idVerification: "verified",
    lastPaymentNote: "Nov rent ₹11,500 + EB ₹825 overdue (due 05 Nov)",
  },
  {
    id: "res-7",
    branchId: "br-annex",
    branchName: "HSR Annex (Sample)",
    name: "Kavya Krishnan",
    phoneMasked: "+91 93XXX XX520",
    roomNumber: "A-102",
    bedLabel: "Bed A",
    status: "active",
    joiningDate: "2026-06-15",
    checkoutDate: null,
    monthlyRentPaise: 1550000,
    depositHeldPaise: 3000000,
    depositTargetPaise: 3000000,
    outstandingPaise: 0,
    idMethod: "manual",
    idTypeLabel: "PAN",
    idSummary: "XXXXX4910K",
    idVerification: "verified",
    lastPaymentNote: "Paid ₹15,500 on 01 Nov 2026 via UPI",
  },
];

export const DEMO_PAYMENTS: DemoPayment[] = [
  { id: "pay-1", date: "2026-11-10", residentName: "Rohan Verma", branchId: "br-main", branchName: "Koramangala Main (Sample)", roomNumber: "101", account: "rent", method: "UPI", amountPaise: 500000, reference: "UPI-DEMO-8812" },
  { id: "pay-2", date: "2026-11-05", residentName: "Karthik Reddy", branchId: "br-main", branchName: "Koramangala Main (Sample)", roomNumber: "101", account: "rent", method: "UPI", amountPaise: 850000, reference: "UPI-DEMO-7401" },
  { id: "pay-3", date: "2026-11-03", residentName: "Aarav Sharma", branchId: "br-main", branchName: "Koramangala Main (Sample)", roomNumber: "101", account: "rent", method: "UPI", amountPaise: 920556, reference: "UPI-DEMO-6120" },
  { id: "pay-4", date: "2026-11-02", residentName: "Priya Nair", branchId: "br-main", branchName: "Koramangala Main (Sample)", roomNumber: "102", account: "rent", method: "Bank Transfer", amountPaise: 1100000, reference: "IMPS-DEMO-3349" },
  { id: "pay-5", date: "2026-11-01", residentName: "Kavya Krishnan", branchId: "br-annex", branchName: "HSR Annex (Sample)", roomNumber: "A-102", account: "rent", method: "UPI", amountPaise: 1550000, reference: "UPI-DEMO-1904" },
  { id: "pay-6", date: "2026-11-01", residentName: "Rohan Verma", branchId: "br-main", branchName: "Koramangala Main (Sample)", roomNumber: "101", account: "deposit", method: "Cash", amountPaise: 1000000, reference: "CASH-DEMO-091" },
];

export const DEMO_MONTHLY_CHART = [
  { month: "Jun", billed: 96000, collected: 94000 },
  { month: "Jul", billed: 104500, collected: 104500 },
  { month: "Aug", billed: 112000, collected: 108500 },
  { month: "Sep", billed: 115500, collected: 115500 },
  { month: "Oct", billed: 118000, collected: 113000 },
  { month: "Nov", billed: 124500, collected: 105100 },
];

function buildEbBill(
  id: string,
  branchId: string,
  branchName: string,
  roomNumber: string,
  month: string,
  monthLabel: string,
  status: "finalized" | "draft",
  totalPaise: number,
  meterReading: string,
  occupancy: Occupancy[],
): DemoEbBill {
  const result = calculateEb(month, totalPaise, occupancy);
  return {
    id,
    branchId,
    branchName,
    roomNumber,
    month,
    monthLabel,
    status,
    totalPaise,
    meterReading,
    daysInMonth: result.days,
    ownerPaise: result.ownerCalculated,
    shares: result.shares,
  };
}

export const DEMO_EB_BILLS: DemoEbBill[] = [
  buildEbBill(
    "eb-101",
    "br-main",
    "Koramangala Main (Sample)",
    "101",
    "2026-11-01",
    "November 2026",
    "finalized",
    200000,
    "4180 → 4430 kWh (250 units)",
    [
      { id: "o1", resident_id: "res-1", name: "Aarav Sharma", start_date: "2026-07-01", end_date: null, status: "active" },
      { id: "o2", resident_id: "res-2", name: "Karthik Reddy", start_date: "2026-09-01", end_date: null, status: "active" },
      { id: "o3", resident_id: "res-3", name: "Rohan Verma", start_date: "2026-11-10", end_date: null, status: "active" },
      { id: "o4", resident_id: "res-d4", name: "Devansh Patel", start_date: "2026-11-20", end_date: null, status: "active" },
    ],
  ),
  buildEbBill(
    "eb-102",
    "br-main",
    "Koramangala Main (Sample)",
    "102",
    "2026-11-01",
    "November 2026",
    "draft",
    240000,
    "3105 → 3405 kWh (300 units)",
    [
      { id: "o5", resident_id: "res-4", name: "Priya Nair", start_date: "2026-05-01", end_date: null, status: "active" },
      { id: "o6", resident_id: "res-5", name: "Vikram Joshi", start_date: "2026-04-01", end_date: "2026-11-10", status: "checked_out" },
    ],
  ),
  buildEbBill(
    "eb-a101",
    "br-annex",
    "HSR Annex (Sample)",
    "A-101",
    "2026-11-01",
    "November 2026",
    "finalized",
    165000,
    "1840 → 2046 kWh (206 units)",
    [
      { id: "o7", resident_id: "res-6", name: "Siddharth Menon", start_date: "2026-08-01", end_date: null, status: "active" },
      { id: "o8", resident_id: "res-d8", name: "Nikhil Joshi", start_date: "2026-08-01", end_date: null, status: "active" },
    ],
  ),
];

export const DEMO_WHATSAPP_PREVIEW = {
  templateTitle: "Monthly Rent & EB Reminder (Sample)",
  renderedMessage: renderTemplate(
    "Hi {name}, your November 2026 balance at {pg} (Room {room}) is {balance}. Due date: {due_date}. Please reply once transferred.",
    {
      name: "Siddharth Menon",
      pg: "Sunrise Residency",
      room: "A-101",
      balance: "₹12,325",
      due_date: "05 Nov 2026",
    },
  ),
};

