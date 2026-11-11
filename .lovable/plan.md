# PG Manager — Existing System Audit and Gap Analysis

This is an audit and plan only. No code or data will change until you approve it.

## A. What already works

- **Branches:** add, edit, turn on or off.
- **Rooms:** add a room with a room number, floor, AC or Non-AC, and sharing type (Single up to 12 sharing). Beds A, B, C… are created automatically, each with its own rent.
- **Beds:** change one bed's rent, add a bed, or remove a bed. An occupied bed can't be removed.
- **Vacant and occupied beds:** worked out from the current resident in each bed.
- **Onboarding:** name, mobile (WhatsApp), alternate mobile, bed, joining date, monthly rent, agreed deposit, deposit paid now, payment method and notes. A resident ID like R1001 is given automatically.
- **Resident editing, room change (with new rent) and checkout** with deposit refunds and deductions.
- **Monthly bills:** one rent bill per resident per month, with no duplicates. People who join or leave mid-month are included. Extra charges, discounts and adjustments can be added, including "Extra charge for everyone" split equally.
- **Payments:** partial and full payments. Each payment clears the oldest bill first. The outstanding balance is always calculated from the records, never typed in.
- **Due rule:** first week or last week of the month, PG-wide. Overdue is shown only after the period ends, and late charges move to next month.
- **Safe money records:** charges and payments are never edited or deleted. Mistakes are fixed by adding a reversal, and staff need permission to reverse.
- **WhatsApp, one resident at a time:** editable welcome, bill and overdue messages. "Open WhatsApp" opens a ready message, you tap "Mark as sent", and history is kept. There is a minimum gap between overdue reminders.

## B. Partly done

- **Rooms:** you can't edit a room's number, floor, AC type or sharing type after creating it, and you can't delete a room. Sharing type is just the number of beds. Rent can only be set per bed, not for the whole room at once.
- **Deposit status:** the paid amount and balance can be calculated, but no "Pending / Partial / Fully paid" label is shown.
- **Billing timing:** first week or last week controls when rent becomes overdue. The bill itself always belongs to the calendar month, so "advance vs arrears" billing doesn't exist as a separate idea.
- **Roles:** only Owner and Staff exist. Your original plan mentioned a Manager role.

## C. Missing

- **Family contact:** guardian, father or mother name and phone.
- **ID proof:** type, number and document upload. There is no file storage yet.
- **Room edit and delete.**
- **WhatsApp Message Center:** named templates, picking a group of residents, preview, leaving people out, and one confirmation for the whole list.
- **Delivery status and failures:** this needs the official WhatsApp API. Links like wa.me can't report delivery.
- **Automatic tasks:** nothing runs on a schedule. Bills are created when someone opens the app.

## D. Gap table

| Requirement | Status | Where now | Change | Priority |
|---|---|---|---|---|
| Add rooms | Implemented | Rooms page, createRoom | — | — |
| Edit room details / sharing | Partial | updateBed (beds only) | New "Edit room": changing sharing adds or removes empty beds only | High |
| Delete room | Missing | — | Hide (not erase) a room only when all its beds are empty | Medium |
| Rent per room or per bed | Partial | beds.bed_rent | "Apply this rent to all beds" option. Each resident's agreed rent stays protected | Medium |
| Change capacity without breaking records | Partial | Occupied-bed check | Same check on room edit | High |
| Guardian name and phone | Missing | residents | New fields on the onboarding and edit forms | High |
| ID type and number | Missing | — | New fields | High |
| ID document upload | Missing | — | Private file storage, viewable only by logged-in staff | Medium |
| Deposit status label | Partial | money_txns (deposit) | Show Pending / Partial / Paid / Balance | High |
| Advance vs arrears billing | Partial | settings.due_window | See open question 1 | High |
| Rent due day / date | Removed by you earlier | — | Keep it removed unless you say otherwise | — |
| Partial / outstanding / overdue rent | Implemented | ledgers, applyFifo | — | — |
| Named message templates | Missing | 3 fixed templates in settings | New template list | High |
| Recipient groups | Missing | Data exists | Group filters, listed below | High |
| Preview, exclude, confirm | Missing | — | Message Center screen | High |
| Bulk send in one click | Missing | wa.me only | Only possible with the official API | Phase 3 |
| History | Partial | notification_log | Add template, month and status | High |
| Duplicate protection | Partial | Overdue gap only | Block the same template + month + resident unless you override | High |
| Delivery status and failures | Missing | — | API delivery updates | Phase 3 |

## E. Implementation phases

**Phase 1 — Rooms and residents**
- Edit and delete rooms safely.
- "Same rent for all beds" option.
- Guardian and ID fields.
- Deposit status labels and a "Pending deposit" filter on Residents.
- ID document upload, if you approve a storage provider (question 4).

**Phase 2 — WhatsApp Message Center (works today, free, no API)**
- A new WhatsApp page with templates (title and text) that you can add, edit or delete.
- Variables: {name} {pg} {rent} {balance} {deposit_balance} {month} {due_date}.
- Choose a template and a month, then a group: All active, Unpaid (incl. partial), No payment, Partial, Fully paid, Overdue, Deposit pending.
- Preview each name, phone and personalised message. Untick anyone to leave them out.
- **Sending without the API:** one confirmation starts a send queue. You press "Open next" for each person: WhatsApp opens with the message ready, you tap send, and it's marked as sent. Phones and browsers don't allow fully automatic sending through links.
- History shows template, month, who marked it and when. A duplicate warning appears before resending.

**Phase 3 — Official WhatsApp Business Cloud API (optional, per PG owner)**
- What each owner needs:
  - their own Meta Business account
  - a verified business
  - a phone number not already used on the normal WhatsApp app
  - templates approved by Meta (they must be submitted for approval)
  - an access token, kept safely as a secret
- **Cost:** Meta charges per message. Utility and marketing messages cost a few paise to about ₹1 each in India, depending on the type, and prices change. There's no hosting cost beyond your current setup.
- **What we build:**
  - a settings screen to connect the account
  - true one-click bulk sending
  - delivery and read status from Meta
  - failure reasons and retry
  - opt-out handling: a STOP reply flags the resident, and they're skipped
  - a consent tick at onboarding
- The manual "Open WhatsApp" option stays as a fallback.

## F. Risks and open questions

1. **Advance vs arrears:** today, both options bill the calendar month. Advance means you pay for November in early November. Should arrears mean "November's bill is due in the last week of November", which is what happens now? Or "November's rent is collected in early December"? The second changes which month bills belong to, and would apply only to new months, never to existing bills.
2. **Due day:** earlier you removed the fixed due day. Your new document mentions "due day or date". Keep first/last week only, or bring a day back?
3. **Room rent:** when you set a room's rent, should it be copied to every bed, or split equally? Earlier you chose no automatic split.
4. **ID document storage:** ID files must be kept private. Options are Cloudflare R2, Vercel Blob or Neon (small files only). Which do you prefer? These files need extra care for privacy.
5. **Manager role:** add it now, and what can a Manager do that Staff can't?
6. **WhatsApp API:** do you want Phase 3 now, or after Phase 2 is in use?
7. **Hosting limits:** automatic daily bills or reminders need a scheduled job, through Vercel Cron or Cloudflare. Without one, bills keep being created when the app is opened, which works today.

## Technical notes
- Reuse: residents, allocations, bills, bill_lines, money_txns, notification_log, ledgers/applyFifo, waLink/markSent.
- New tables/columns:
  - wa_templates (id, title, body, is_active)
  - notification_log: add template_id, billing_month, status, provider_msg_id, error
  - residents: add guardian_name, guardian_phone, id_type, id_number, id_doc_key, wa_opt_out
  - Phase 3 only: wa_config (single-row table)
  - All added to src/lib/schema.ts as idempotent statements, then db/schema.sql regenerated.
- Phase 3 webhook at /api/public/whatsapp, with Meta signature verification. Every new server function calls requireUser or requireOwner first.
- No rewrite needed. The current Neon setup works on both Lovable and Vercel.
