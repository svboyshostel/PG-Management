import { z } from "zod";

export const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const date = new Date(s + "T00:00:00Z");
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s;
  }, "Enter a real calendar date.");
export const calendarMonth = calendarDate.refine((s) => s.endsWith("-01"), "Choose a month.");
export const paymentInput = z.object({
  residentId: z.string().uuid(),
  account: z.enum(["rent", "deposit"]),
  amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  method: z.enum(["cash", "upi", "bank"]),
  reference: z.string().max(200).optional(),
  date: calendarDate,
  idem: z.string().trim().min(1).max(200),
});
export const loginInput = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(1024),
});
export const recoveryResetInput = z.object({ email: z.string().trim().email().max(255), code: z.string().trim().min(1).max(64), password: z.string().min(1).max(200) });
