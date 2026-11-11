# PG Management System — Complete User Guide

**Application Name:** PG Manager  
**Edition:** Manual WhatsApp & Cloud Private Storage Edition  
**Intended Audience:** PG Owners & Authorized Branch Staff  
**Document Purpose:** Complete Client Operations & Handover Manual  

---

> **IMPORTANT SECURITY NOTICE:**
> **Save your Owner Recovery Code securely during first-time account setup. It is shown only once. Do not share your password or recovery code with staff or unauthorized individuals.**

---

## Table of Contents

- [Section A: Introduction & Getting Started](#section-a-introduction--getting-started)
- [Section B: Password Management & Recovery Codes — HIGH PRIORITY](#section-b-password-management--recovery-codes--high-priority)
- [Section C: Dashboard & Navigation](#section-c-dashboard--navigation)
- [Section D: Branch, Room & Bed Management](#section-d-branch-room--bed-management)
- [Section E: Resident Onboarding](#section-e-resident-onboarding)
- [Section F: Monthly Rent & Additional Charges](#section-f-monthly-rent--additional-charges)
- [Section G: Room-wise Electricity Billing](#section-g-room-wise-electricity-billing)
- [Section H: Payment Management](#section-h-payment-management)
- [Section I: WhatsApp Communication](#section-i-whatsapp-communication)
- [Section J: Resident Changes](#section-j-resident-changes)
- [Section K: Resident Checkout](#section-k-resident-checkout)
- [Section L: Reports & Exports](#section-l-reports--exports)
- [Section M: Staff Management & Settings](#section-m-staff-management--settings)
- [Section N: Troubleshooting](#section-n-troubleshooting)
- [Section O: Security & Client Handover](#section-o-security--client-handover)
- [Quick Start Checklist (One-Page Reference)](#quick-start-checklist-one-page-reference)
- [Password Recovery Quick Reference (One-Page Reference)](#password-recovery-quick-reference-one-page-reference)
- [Handover Verification Summary](#handover-verification-summary)

---

## Section A: Introduction & Getting Started

### 1. What PG Manager Does
**PG Manager** is a web-based property operations and accounting application built specifically for Paying Guest (PG) accommodations and hostels. It keeps all daily and monthly PG operations in one organized system:

- **Multi-Branch & Room Occupancy:** Track branches, floors, AC/Non-AC rooms, bed capacities (up to 12-sharing), individual bed rates, and live vacancy.
- **Resident Records & Private ID Proofs:** Store resident contact numbers, guardian details, masked Aadhaar or other ID numbers, and private uploaded ID documents (JPEG, PNG, or PDF up to 4 MB).
- **Automated Monthly Rent Billing & FIFO Payments:** Automatically generate monthly rent bills, add extra charges or discounts, track security deposits, and apply incoming payments oldest-bill-first.
- **Owner-Controlled Room Electricity Splitting:** Split monthly room electricity bills fairly day-by-day across residents based on exact occupancy, while separating vacant-day costs as owner-borne.
- **Manual WhatsApp Sharing:** Prepare personalized rent bills, overdue reminders, deposit reminders, and announcements using reusable templates and open them directly in WhatsApp for manual sending.
- **Role-Based Staff Access:** Create separate staff logins restricted strictly to assigned branches, with controlled permissions for payment reversals and WhatsApp messaging.

### 2. Supported Devices & PWA Installation
PG Manager works smoothly across:
- **Desktop & Laptop Browsers:** Google Chrome, Microsoft Edge, and Safari on Windows or macOS.
- **Mobile & Tablet Browsers:** Chrome on Android and Safari on iPhone/iPad.

> **NOTE — Internet Connection Required:** PG Manager runs as an **online-first Progressive Web App (PWA)**. You can install it as an app shortcut on your phone or computer, but an active internet connection is required to load resident data, save payments, generate bills, or view ID documents.

#### How to Install PG Manager as an App
Whenever you are viewing PG Manager in a supported browser (before or after signing in), look for the **"Install PG Manager"** button (located on the **First-time setup** card, **Sign in** screen, **Demo Preview** bar, desktop left sidebar, or mobile top bar):

1. Open your PG Manager website link in Chrome, Edge, or Safari.
2. Click or tap **"Install PG Manager"**.
3. If a browser confirmation popup appears, choose **Install**.
4. If your browser does not support a one-click prompt, clicking **"Install PG Manager"** reveals instructions tailored to your device:

| Device / Browser | How to Install Manually |
| :--- | :--- |
| **Android (Chrome)** | Tap the browser menu (`⋮`) and select **Install app** or **Add to Home screen**. |
| **iPhone / iPad (Safari)** | Tap the **Share** icon (`↑`) in Safari, then choose **Add to Home Screen**. |
| **Windows / Mac (Chrome or Edge)** | Open the browser menu or click the **Install icon** in the address bar, then select **Install PG Manager**. |
| **Mac (Safari)** | In the Safari menu bar, choose **File → Add to Dock**. |

### 3. Opening the Application URL
1. Open your browser and enter the PG Manager web address provided for your PG.
2. On a brand-new system with no owner account yet, the application opens the **First-time setup** screen automatically.
3. Once owner setup is finished, opening the home URL automatically redirects to **Sign in** (or straight to **Dashboard** if you are already signed in on that browser).
4. If **Demo Preview** is enabled on your site, a **"Demo Preview"** button appears on the Sign-in and Setup screens so you can explore sample fictional data safely without touching your live records.

> **[Screenshot Placeholder — First-Time Setup Screen]**  
> *Shows the "PG Manager — First-time setup" card with fields for PG name, Your name, Email, Password (min 8), the "Create my PG" button, "Install PG Manager", and optional "Open Demo Preview (read-only)".*

### 4. First-Time Owner Account Creation
Follow these steps only once when initializing your PG for the very first time:

1. Open your application URL. Confirm the screen displays **"First-time setup"** and **"Database connected. Create your PG and the owner login. Tables are created automatically."** *(If you see a message asking to connect the database instead, stop and contact your system administrator before proceeding.)*
2. Fill in the four required fields:
   - **PG name:** Enter your PG or Hostel business name (for example, `Sri Sai Boys Hostel`).
   - **Your name:** Enter the Owner's full name.
   - **Email:** Enter the Owner's email address used for signing in.
   - **Password (min 8):** Choose a strong password with at least 8 characters.
3. Click **"Create my PG"**.
4. Immediately upon creation, the screen changes to **"One last step: save your recovery code."**
5. **Do not close this screen yet.** Click **"Copy code"**, store your 24-character recovery code safely (see [Section B](#section-b-password-management--recovery-codes--high-priority)), check **"I have saved my recovery code"**, and click **"Go to dashboard"**.

### 5. Initial PG Configuration
Before adding rooms or residents, complete these two quick setup tasks in **Settings**:

1. Click **Settings** in the navigation menu.
2. **Add your first branch (`Branches` tab):**
   - Enter **Branch name** (e.g., `Main Building` or `Koramangala Block A`) and **Address**.
   - Click **"Add branch"**. *(Rooms cannot be created until at least one active branch exists.)*
3. **Verify General PG details (`General` tab):**
   - Confirm or update **PG name**, **Phone**, and **Address**.
   - Select your **Monthly rent due day** (Day `1` to `28` of every month; default is **Day 7**).
   - Select your **Timezone** (default is `Asia/Kolkata`).
   - Click **"Save"**.

### 6. Login and Logout

#### Signing In
1. Go to the **Sign in** screen.
2. Enter your **Email** and **Password**. *(You can click the eye icon inside the Password field to show or hide what you typed.)*
3. Click **"Sign in"**. Your session remains active on that browser for up to 30 days unless you sign out or reset your password.

> **[Screenshot Placeholder — Sign In Screen]**  
> *Shows the "PG Manager — Sign in" card with Email, Password (with eye toggle), "Sign in" button, "Forgot password?" link, staff recovery note, "Install PG Manager", and optional "Demo Preview".*

#### Signing Out
- **Desktop:** Click **"Sign out"** at the bottom of the left sidebar.
- **Mobile:** Tap **"Sign out"** in the top-right header bar.

---

## Section B: Password Management & Recovery Codes — HIGH PRIORITY

> **IMPORTANT: Save your recovery codes securely during account setup. Do not share them with staff or unauthorized individuals.**

This application uses **offline, one-time cryptographic recovery codes** instead of email password-reset links. Read this entire section carefully so you never lose access to your Owner account.

### 1. How the Owner Creates the First Account
- PG Manager allows **one Owner account**, created during **First-time setup** (`/setup`) by entering **PG name**, **Your name**, **Email**, and **Password (min 8 characters)**, then clicking **"Create my PG"**.
- Passwords are stored securely as salted PBKDF2 hashes (minimum 8 characters, maximum 200 characters).

### 2. When and How Recovery Codes Are Generated
- Your first **Owner Recovery Code** is generated automatically at the exact moment **"Create my PG"** succeeds.
- A fresh code is a **24-character code** displayed in six groups of four characters, such as `ABCD-EFGH-JKLM-NPQR-STUV-WXYZ` (using clear uppercase letters and digits `2–9`; look-alike characters `I`, `O`, `0`, and `1` are never used).
- Only a one-way cryptographic hash tied to your Owner account is stored in the database. **Your plain recovery code is never saved anywhere on the server.**

### 3. Where Recovery Codes Appear
Your active recovery code is displayed **on-screen once** in three situations only:
1. **At First-Time Setup:** Right after clicking **"Create my PG"** (`"One last step: save your recovery code."`).
2. **After Resetting a Forgotten Password:** On the **"Password changed"** screen right after clicking **"Set new password"** (`"Your old recovery code no longer works. Here is your new one."`).
3. **When Rotating While Signed In:** Inside **Settings → Security**, right after clicking **"Create a new recovery code"** (or **"Create recovery code"**).

> **[Screenshot Placeholder — Your Recovery Code Screen]**  
> *Shows the bordered "Your recovery code" box displaying the 24-character monospace code, the "Copy code" button, the 3 security bullet points, the "I have saved my recovery code" checkbox, and the confirmation button ("Go to dashboard" / "Go to sign in" / "Done").*

### 4. How to Copy or Save Your Recovery Code
Based on the current application screen:
1. Click **"Copy code"** to copy the full code to your device clipboard (you will see a `"Copied"` confirmation; if your browser blocks clipboard access, you will see `"Couldn't copy — please write it down."`).
2. Paste the code into a secure password manager, or write every character clearly on paper.
3. **Note on Export Options:** The current screen provides **"Copy code"** only—there is no automatic PDF/text file download or Print button inside the recovery box. Please save or print your copy manually.
4. Tick the **"I have saved my recovery code"** checkbox to unlock the finish button (**"Go to dashboard"**, **"Go to sign in"**, or **"Done"**).

### 5. Why Recovery Codes Must Be Saved Before Closing the Screen
- Once you check **"I have saved my recovery code"** and leave the screen (or close your browser tab), **that recovery code can never be retrieved or displayed again**.
- Nobody—not staff, not support—can look up your lost code because only a one-way mathematical hash exists in the database.

### 6. How to Use a Recovery Code When the Owner Forgets the Password
If you are the **Owner** and forget your login password:
1. Open the **Sign in** screen.
2. Click **"Forgot password?"** directly below the **"Sign in"** button.

### 7. Exact Password Reset Steps, Fields & Buttons
1. On the **Forgot password** screen, fill in:
   - **Email:** Your Owner email address.
   - **Recovery code:** Your saved 24-character code (`XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`). *(Spaces, dashes, and uppercase/lowercase differences do not matter—just make sure all 24 characters match.)*
   - **New password (min 8):** Your new password (at least 8 characters).
   - **Confirm new password:** Re-enter the exact same new password. *(Click the eye icon if you want to verify what you typed.)*
2. Click **"Set new password"**.
3. If your email and recovery code match:
   - Your password is updated immediately.
   - **All existing active sessions for the Owner across every phone and computer are signed out.**
   - Your old recovery code is permanently invalidated.
   - A **brand-new replacement recovery code** appears on the **"Password changed"** screen.
4. Click **"Copy code"** and save the **new** recovery code right away (replace your old written/saved copy!).
5. Check **"I have saved my recovery code"** and click **"Go to sign in"**.
6. Log in using your email and new password.

> **[Screenshot Placeholder — Forgot Password Screen]**  
> *Shows the "PG Manager — Forgot password" card with Email, Recovery code input (`XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`), New password (min 8) with show/hide eye icon, Confirm new password, "Set new password" button, and "Back to sign in" link.*

#### Attempt Limits (Lockout Protection)
- To stop unauthorized guessing, the system allows up to **5 failed recovery attempts** per email (and 30 failed attempts globally) within a **15-minute window**.
- Exceeding this shows: `"Too many wrong attempts. Please wait 15 minutes and try again."` Wait 15 minutes before retrying carefully.

### 8. Are Recovery Codes Single-Use?
**Yes.** Every Owner recovery code works **strictly once**.
- The moment you use it on **Forgot password**, it stops working permanently.
- However, a **new single-use replacement recovery code** is automatically generated and shown to you on the **"Password changed"** screen so you are always protected for future emergencies—provided you save the new one.

### 9. Generating Replacement Recovery Codes While Signed In (Supported)
If you still know your current password (for example, if you misplaced your written code or think someone else saw it), you **can** generate a fresh replacement code at any time:

1. Sign in as the **Owner** and open **Settings**.
2. Click the **Security** tab.
3. The screen displays when your current recovery code was created (`"A code was created on <date>. Making a new one stops the old one working."`).
4. Enter **"Your current password"**.
5. Click **"Create a new recovery code"** (or **"Create recovery code"** if none exists yet).
6. Immediately copy and save the new code displayed on screen, check **"I have saved my recovery code"**, and click **"Done"**.
   - **Warning:** Generating a new code immediately disables your previous recovery code.

### 10. What Happens When Recovery Codes Are Lost or Exhausted
- Because PG Manager is self-contained and does **not** send email reset links:
  - **If you lose your recovery code while you STILL remember your password (or are still signed in):** Open **Settings → Security**, enter your current password, and generate a new recovery code immediately.
  - **If you lose BOTH your Owner password AND your current active recovery code:** There is **no** in-app method to reset the Owner account. Recovery in that emergency requires technical database administrator intervention directly on the database.

### 11. How Staff Password Recovery Differs
- Staff accounts **do not receive or use recovery codes** and **cannot** use the **Forgot password?** page.
- If a staff member forgets their password:
  1. The staff member must contact the **Owner**.
  2. The **Owner** signs in, opens **Settings → Staff**, finds the staff member, and clicks **"Reset password"**.
  3. A prompt appears (`"New password (min 8)"`). The Owner enters a temporary or new password (minimum 8 characters) and confirms.
  4. Saving immediately updates the staff member's password and signs them out of any active sessions so they must sign in with the new password.

### 12. Recommended Secure Storage Practices for Your Recovery Code
- **Recommended:** Save inside a trusted password manager (such as Bitwarden, 1Password, or Apple/Google Password Manager with account backup) **and** keep one neatly written physical backup in a locked home/office safe.
- **Always label the date:** When you rotate your code (either via **Forgot password** or **Settings → Security**), cross out or delete the older code immediately so you never confuse old and current codes.
- **Never store in:** Shared WhatsApp groups, plain SMS messages, sticky notes near the PG reception desk, or shared Excel/Google Sheets accessible to staff.

---

## Section C: Dashboard & Navigation

### 1. Application Navigation
After signing in, PG Manager adapts its layout to your device:
- **Desktop (`md` screens and wider):** Fixed left sidebar displaying the **PG Manager** logo, navigation links, your signed-in name & role (`owner` or `staff`), **"Install PG Manager"** button, and **"Sign out"**.
- **Mobile:** Top bar with **PG Manager**, **Install PG Manager**, and **Sign out**; fixed bottom navigation bar for quick thumb access.

| Menu Item | Who Sees It | Purpose |
| :--- | :--- | :--- |
| **Dashboard** | Owner & Staff (with assigned branches) | Live occupancy, monthly billing/collection stats, overdue alert list, 6-month collection trend. |
| **Residents** | Owner & Staff (with assigned branches) | Search/filter active & past residents, add bulk charges, open resident profiles, onboard new residents. |
| **Rooms** | Owner & Staff (with assigned branches) | Manage rooms, beds, bed rents, vacancy status, and (Owner-only) Room-wise Electricity Billing. |
| **Payments** | Owner & Staff (with assigned branches) | View all monthly rent, deposit, adjustment, and refund transactions, generate bills, export monthly CSV. |
| **WhatsApp** | Owner & permitted Staff (`Can send WhatsApp`) | Prepare manual WhatsApp send queues, resume history, and (Owner-only) manage templates & reminder gap. |
| **Settings** | **Owner only** | Manage branches, general PG settings, staff accounts/permissions, database updates, and Owner recovery codes. |

> **NOTE for New Staff Accounts:** If a newly created staff user signs in before the Owner assigns them at least one branch, every page shows: *"No branches assigned. Ask the owner to assign you a branch."*

### 2. Understanding Dashboard Cards, Charts & Actions
1. **Page Header & Quick Actions:**
   - Displays your **PG Name** and the current calendar month (in your PG timezone).
   - **Branch Filter Dropdown** (visible automatically when you have 2 or more active branches accessible): Switch between **All branches** or a specific branch to filter all Dashboard cards, charts, and lists.
   - **Quick Buttons:** **Rooms** (jumps to Room & Bed view) and **Add resident** (starts onboarding).
2. **Four Key Metric Cards:**
   - **Occupancy:** Shows `Occupied / Total` active beds and the exact number of vacant beds (`X beds vacant`).
   - **Billed this month:** Total rupee amount of all bill lines (rent, extra charges, adjustments minus discounts/reversals) for the current billing month.
   - **Rent collected:** Net rent payments received in the current calendar month (rent receipts minus rent reversals), plus a hint line showing **Deposits** collected this month.
   - **Total pending:** Total unpaid rent/charge balance across all active residents (across current and older months), plus a hint showing the count of overdue residents (`X overdue`).
3. **Overdue Residents Panel:**
   - Lists up to **50 active residents** with overdue unpaid balances (`outstanding > 0` past their saved bill due date), sorted by largest pending balance first.
   - Shows resident name, code (`R1001`...), branch name, oldest unpaid due date (`due since ...`), and pending amount.
   - Click any row to jump directly to that resident's profile to collect payment or send a WhatsApp reminder.
4. **Rent Collected (6 Months) Chart:**
   - Interactive bar chart comparing net monthly rent collected across the past 6 months. Hover or tap bars to inspect exact rupee figures.

> **[Screenshot Placeholder — Dashboard Screen]**  
> *Shows PG header, branch dropdown, 4 summary cards (Occupancy, Billed this month, Rent collected, Total pending), Overdue residents list on the left, and 6-month Rent collected bar chart on the right.*

---

## Section D: Branch, Room & Bed Management

### 1. Branch Creation & Management (Owner Only)
Navigate to **Settings → Branches**:
1. **Add a Branch:** Enter **Branch name** and **Address**, then click **"Add branch"**.
2. **Edit a Branch:** Click **"Edit"** next to any existing branch, update its name or address in the top form, and click **"Save branch"** (or **"Cancel"** to discard).
3. **Activate / Deactivate a Branch:** Toggle the **"Active"** switch on a branch row. Inactive branches are hidden from new room creation and vacant-bed onboarding pickers while preserving historical financial records.

### 2. Adding a Room (`Rooms → Add room`)
> **Prerequisite:** You must have at least one **Active** branch in **Settings → Branches** before adding rooms.

1. Open **Rooms** from the navigation menu and click **"Add room"**.
2. Fill in the **Add room** dialog:
   - **Branch:** Choose the branch this room belongs to.
   - **Room number:** Enter the room identifier (for example, `101`, `G-02`). *Active room numbers must be unique within the same branch.*
   - **Floor:** Optional floor name/number (for example, `1` or `Ground`).
   - **Sharing (persons per room):** Select **Single** (`1`) through **12 sharing** (`12`). The app automatically creates beds labeled `A`, `B`, `C`, etc.
   - **Rent per bed (₹):** Default monthly rent for every bed created in this room.
   - **AC room:** Tick this checkbox if the room has air conditioning.
3. Click **"Add room"**.

> **[Screenshot Placeholder — Rooms & Beds Grid]**  
> *Shows branch filter dropdown, "Add room" button, and room cards with room number, sharing/AC badge, occupancy ratio (e.g., 2/3), color-coded bed rows (occupied vs Vacant), clickable bed rents, "+ Add bed", "Edit room", "Electricity bill", and "Archive".*

### 3. Configuring Individual Beds & Occupancy Status
Each room card displays its current occupancy (for example, **`2/3` · `1 vacant`**) and lists every active bed (`A`, `B`, `C`...):
- **Occupied beds** appear tinted and show the resident's name as a clickable link straight to their profile.
- **Vacant beds** appear grayed/muted with `"Vacant"`.
- **Change an individual bed's default rent:** Click the rupee amount (e.g., `₹6,500`) on a bed row, edit the amount in the inline box, and click **"OK"**.
  - *Important:* Changing a bed's rate updates the bed's listing price for **future** residents only; existing residents keep their agreed monthly rent.
- **Add one extra bed to a room:** Click **"+ Add bed"** at the bottom of the room card, enter the rent for the new bed in rupees, and confirm. *(Allowed up to 12 total active beds per room.)*
- **Remove a vacant bed:** Click **`✕`** beside a vacant bed and confirm `"Remove this vacant bed?"`. *(Occupied beds cannot be removed; move or check out the resident first.)*

### 4. Editing a Room (`Edit room`) & Capacity Rules
Click **"Edit room"** on a room card to modify:
- **Room number**, **Floor**, and **AC room** checkbox.
- **Sharing capacity (`1–12`):**
  - Increasing sharing adds new vacant beds (skipping previously used/archived letter labels).
  - Decreasing sharing removes the **highest-labeled vacant beds** automatically. Options lower than your currently occupied bed count are disabled (`"too few for current residents"`).
- **Rent updates:**
  - Tick **"Apply the same rent to all beds"** and enter **"Rent for every bed (₹)"** to update all beds in that room at once, OR enter **"Rent for new beds (₹)"** when adding beds.
  - Current residents keep the rent they already agreed to.

### 5. Archiving an Empty Room (`Archive`)
- When a room has **0 occupied beds**, an **"Archive"** button appears on the room card.
- Clicking **"Archive"** deactivates the room without deleting past resident allocations, bills, or Room EB history. Rooms with any occupied bed cannot be archived.

---

## Section E: Resident Onboarding

Open **Residents → Add resident** (or click **Add resident** from the Dashboard) to onboard a new tenant.

> **Prerequisite:** At least one vacant bed must exist in an active branch to which you have access.

### Step-by-Step Resident Onboarding
1. **Personal & Contact Details:**
   - **Full name** *(required)*
   - **Mobile (WhatsApp)** *(required — enter a 10-digit mobile number for WhatsApp sharing)*
   - **Alternate mobile** *(optional emergency/secondary number)*
2. **Room / Bed Selection:**
   - Open the **Bed** dropdown (`"Choose a vacant bed"`). Available rooms with vacant beds are grouped by branch (if multiple branches exist), showing `Room · Sharing · AC/Non-AC — ₹Bed Rent`. Selecting an option auto-fills **Monthly rent (₹)**.
3. **Joining & Rent Agreement:**
   - **Joining date** *(defaults to today; future advance booking dates are supported)*
   - **Monthly rent (₹)** *(pre-filled from the bed rate; can be customized for this resident's agreed rent)*
4. **Security Deposit & Payment at Joining:**
   - **Deposit agreed (₹):** Total refundable security deposit agreed with the resident (enter `0` or leave blank if no deposit).
   - **Deposit paid now (₹):** Amount of security deposit actually collected on joining day.
   - **Payment method:** Choose **Cash**, **UPI**, or **Bank** for the initial deposit paid.
5. **Guardian & ID Proof Fields:**
   - **Guardian / parent name**, **Relationship** (`Father`, `Mother`, `Guardian`, `Spouse`, `Sibling`, `Other`), and **Guardian contact number**.
   - **ID proof method:**
     - **Not collected yet** — Leave blank to collect later.
     - **Enter ID number** — Choose **ID proof type** (`Aadhaar`, `PAN`, `Driving licence`, `Passport`, `Voter ID`, `Other`) and enter **ID number**.
       - **Aadhaar Privacy Rule:** For Aadhaar, you must enter all **12 digits**; PG Manager automatically stores **only the masked last 4 digits** (`XXXX XXXX 1234`) and never saves the full Aadhaar number.
     - **Private document (on resident page)** — *Disabled on the Add resident screen.* See [Uploading a Private ID Document](#uploading-a-private-id-document-after-saving) below!
6. **Notes:** Enter any special agreement notes.
7. Click **"Add resident"**. PG Manager creates the resident (assigning an automatic code such as `R1001`), locks the bed allocation, records any deposit paid now, and generates their first monthly rent bill if their joining date falls in the current or an earlier month.

> **[Screenshot Placeholder — Add Resident Form]**  
> *Shows the "Add resident" form with Full name, Mobile (WhatsApp), Bed selector, Joining date, Monthly rent (₹), Deposit agreed (₹), Deposit paid now (₹), Payment method, Guardian fields, ID proof fields, Notes, and "Add resident" button.*

> **IMPORTANT — Two Key Things to Know Right After Onboarding:**
> 1. **Collecting the First Month's Rent:** The **Add resident** form collects **Security Deposit Paid Now**, not rent. To record the resident's first rent payment, immediately click **"Collect payment"** on the newly opened Resident Profile page, leave **For** set to **Rent & charges**, enter the amount, and click **"Record ₹..."**.
> 2. **Uploading an ID Document Image or PDF (Up to 4 MB):** File upload happens on the **Resident Profile** page *after* saving the resident—not inside the initial Add resident form.

### Uploading a Private ID Document (After Saving)
Once you are on the resident's profile page (`/residents/<id>`):
1. Locate the **Guardian & ID** card and scroll to **Private ID document**.
2. Select the **Document ID type** (`Aadhaar`, `PAN`, `Driving licence`, `Passport`, `Voter ID`, or `Other`).
3. Click **Private ID file** and choose a **JPEG, PNG, or PDF** file up to **4 MB** (`4,194,304` bytes).
   - *Validation:* Files larger than **4 MB**, unsupported file extensions, or files whose actual contents do not match JPEG/PNG/PDF signatures are rejected with a clear error message.
4. Click **"Upload ID"**.
5. Once uploaded:
   - Only **one active private document** can be stored per resident at a time.
   - Click the **Eye icon (`View document`)** to preview securely in a new tab, **Download icon (`Download document`)** to save locally, or **Trash icon (`Delete document`)** to delete it (required before uploading a replacement or switching back to manual ID number entry).
   - **ID Verification Status:** By default, uploaded or entered IDs show **`Pending`**. Only the **Owner** can mark an ID as **`Verified`** or **`Rejected`** under **Resident → Edit → ID verification**.

---

## Section F: Monthly Rent & Additional Charges

### 1. Monthly Bill Generation & Due-Date Rules
- **Automatic Bill Creation:** Opening **Dashboard**, **Residents**, or **WhatsApp → Send messages** (and onboarding a resident or clicking **Payments → Generate bills**) automatically creates the monthly rent bill and rent line for every active resident whose bed allocation overlaps that month. Re-running never creates duplicate bills.
- **No Future Bills:** Rent bills cannot be generated for future calendar months.
- **PG-Wide Due Day (`1–28`):** Configured by the Owner under **Settings → General → Monthly rent due day** (default **Day 7**).
- **Mid-Month Joiner Protection Rule:** If a resident's joining date (or room allocation start date) is **after** that month's due day (for example, joining on `12 November` when due day is `7`), their November bill is given a due date on **next month's due day (`7 December`)**. That way, mid-month joiners are never marked overdue on day one.
- **Changing the Due Day Later:** Updating the due day in Settings applies to the current month, future months, and older bills whose due dates have not yet passed—leaving earlier completed history untouched.

### 2. Reading "This Month's Bill" on a Resident Profile
On any resident's profile page, the **This month's bill** card breaks down the current month cleanly:
- **Monthly rent** (always displayed)
- **Electricity**, **Water**, **Cleaning**, **Maintenance**, **Other charges** (shown whenever non-zero)
- **Discounts & adjustments** (shown whenever non-zero)
- **Previous unpaid:** Any remaining balance carried over from earlier months
- **Paid towards this bill:** Payments allocated to this month's bill
- **Total outstanding:** `Previous unpaid` + remaining balance on this bill
- **Due date:** Saved due date for this month's bill

### 3. Adding Extra Charges, Discounts & Adjustments (Single Resident)
On a resident's profile page, click **"Charge / discount"**:

| Entry Type | Required Inputs | Which Month's Bill It Affects |
| :--- | :--- | :--- |
| **Extra charge** | **Category** (`Electricity`, `Water`, `Cleaning`, `Maintenance`, `Other`), **Description**, **Amount (₹)** | **Automatic due-day rule:** Added on or before this month's due day → **this month's bill**. Added after this month's due day → **next month's bill**. *(Shown right in the dialog before saving!)* |
| **Discount** | **Month**, **Description**, **Amount (₹)**, **Reason (required)** | Subtracts from the chosen **Month**'s bill. *(Cannot exceed the chosen bill's total payable amount.)* |
| **Adjustment (added to bill)** | **Month**, **Description**, **Amount (₹)**, **Reason (required)** | Adds to the chosen **Month**'s bill. |

### 4. Adding Bulk Extra Charges (`Residents` Page)
Use the **Residents** page to add a single charge across multiple residents at once:
- **Option A — Split among all filtered active residents:** In the **"Extra charge for everyone"** card at the top of **Residents**, click **"Split among X residents"** (it uses the currently filtered active residents shown in the table).
- **Option B — Selected residents only:** Tick the checkboxes beside specific residents in the table (use **Branch**, **Search**, or **Payment** filters first if needed), then click **"Add charge to X"** at the top-right.
- In the **Add charge to X residents** dialog:
  1. Enter **Description** (default `"Electricity"`).
  2. Choose **"Split total equally"** (splits the total amount equally down to the exact paisa, adjusting `₹0.01` rounding across the first residents so the sum is exact) OR **"Same amount each"**.
  3. Enter **Total amount (₹)** or **Amount per resident (₹)** and preview the exact per-resident list below.
  4. Click **"Confirm and add"**. Bulk charges automatically follow the PG due-day rule (this month's bill if added on/before the due day; next month's bill if after).

### 5. Reversing Incorrect Charges (Append-Only Audit Rule)
Financial bill lines are **never edited or deleted**. To cancel a mistaken line:
1. Open the resident's profile and select the **Bills** tab.
2. Click **"Reverse"** beside the line item.
3. Enter a **Reason** and click **"Confirm reversal"**. A matching offsetting reversal line is appended and the original line appears struck through.
   - **Permission Rule:** Only the **Owner** sees and can reverse a **`Monthly rent`** line (`kind = 'rent'`). Both Owner and branch-permitted staff can reverse extra charges, discounts, or adjustments. Existing reversals cannot be reversed again.

---

## Section G: Room-wise Electricity Billing

> **IMPORTANT — How Room-wise EB Works in This Edition:**
> PG Manager's **Room-wise EB** takes the **total monthly electricity bill amount (`Total room EB (₹)`)** for a room and splits it automatically across residents **by exact calendar days lived in that room during that month**. It does **not** store electric meter unit readings (`Start Unit` / `End Unit` kWh).

Room-wise Electricity Billing is restricted **strictly to the Owner** (`Staff` accounts do not see the EB buttons).

### 1. Opening Room-wise Electricity Billing
- **From Rooms:** Click **"Electricity bill"** on any room card.
- **From Residents:** In the top card, pick a room from **"Choose EB room"** and click **"Room-wise EB"**.

> **[Screenshot Placeholder — Room Electricity Bill Dialog]**  
> *Shows "Room <number> · Electricity bill" with Billing month, Total room EB (₹), "Calculate EB" button, resident table (Resident, Days, Calculated EB, editable Final EB (₹), Difference), Total allocated vs Unallocated / owner-borne summary, "I accept ₹... as owner-borne" checkbox, "Save Draft", "Finalize", and Room EB history.*

### 2. Calculating, Adjusting & Finalizing Room EB
1. Choose **Billing month** (`YYYY-MM`) and enter **Total room EB (₹)**.
2. Click **"Calculate EB"**.
   - PG Manager checks room allocation history for every calendar day of that month.
   - Each day's cost is divided equally among residents occupying the room on that day.
   - Any day where the room had **zero occupants** is automatically counted as **Unallocated / owner-borne** (vacant-day cost is never pushed onto active residents unless you manually edit it).
   - Fractions are rounded once accurately so totals never drift.
3. **Review or Adjust Resident Shares (Optional):**
   - Each resident row displays **Days** present, **Calculated EB**, an editable **Final EB (₹)** input, and **Difference** (`Final - Calculated`).
   - Checked-out residents who lived in that room during the billing month are clearly labeled **`Checked out · separate reconciliation`**.
4. **Reconcile Totals:**
   - **If `Total allocated > Total room EB`:** The system shows `"Resident charges exceed the total bill. Reconcile before finalizing."` — **Finalize** is blocked until you reduce resident shares so total allocated never exceeds the room bill.
   - **If `Unallocated / owner-borne > ₹0`:** You must tick **"I accept ₹... as owner-borne."** before finalizing.
5. **Save Draft or Finalize:**
   - Click **"Save Draft"** to save work-in-progress without posting charges to resident bills yet. Drafts track versions so stale tabs cannot overwrite newer edits.
   - Click **"Finalize"** when ready and confirm the warning prompt: *"Finalize electricity charges? Finalized bills cannot be edited. Checked-out residents will have separate pending liabilities."*

### 3. Strict Restrictions & Checked-Out Liabilities After Finalization
- **Permanent Lock:** Once **Finalized**, a room electricity bill for that room and month becomes **100% immutable** (enforced at the database level). You cannot reopen, edit, or re-calculate it.
- **Active Residents:** Receive an itemized bill line (`"Room electricity — Mon YYYY"`) automatically in the current charge month (determined by the PG due-day rule).
- **Checked-Out Residents (`Resident liabilities`):** Completed checkout settlements are **never** retroactively rewritten. Instead, the checked-out resident's share appears under **Resident liabilities** (`Pending checkout reconciliation`), where the Owner must resolve it by clicking one of two buttons (each requiring a reason):
  - **Record new charge:** Posts a separate new bill line (`Post-checkout EB adjustment`) to that checked-out resident's ledger without modifying their old checkout deposit/refund entries.
  - **Owner bears:** Marks the checked-out resident's share as absorbed by the PG Owner (`owner_borne`).

---

## Section H: Payment Management

### 1. Recording Rent & Deposit Payments
1. Open an **active** resident's profile (`/residents/<id>`).
2. Click **"Collect payment"**.
3. Fill in the **Collect payment** form:
   - **For:** Choose **Rent & charges** (pre-filled with current pending rent) or **Security deposit**.
   - **Amount (₹):** Enter the rupee amount received (supports partial or advance amounts).
   - **Method:** Select **Cash**, **UPI**, or **Bank**.
   - **Reference (optional):** Enter UTR number, bank reference, or paper receipt number.
   - **Date:** Payment date (defaults to today).
4. Click **"Record ₹..."**.

### 2. Partial Payments & FIFO Allocation Rule
- **Rent & charges payments** are applied automatically **oldest unpaid bill first** (First-In, First-Out / FIFO).
  - *Example:* If a resident owes ₹2,000 from October and ₹8,000 for November, a ₹5,000 payment first marks October **Paid** (₹2,000) and reduces November to ₹5,000 due.
- **Advance / Credit:** If a resident pays *more* than all existing unpaid rent/charge bills, the leftover balance automatically appears in **Advance / credit** and will automatically reduce future generated bills.
- **Security deposit payments** go into the separate deposit account, updating the resident's deposit card badge (**Pending** → **Partially Paid** → **Fully Paid**) and increasing **held now**.

### 3. Receipts, Transaction History & Reversals
- **Viewing History:**
  - **Per Resident:** Open the **Payments** tab on a resident's profile to see every `rent_payment`, `deposit_receipt`, `deposit_deduction`, `deposit_to_dues`, `deposit_refund`, `credit_refund`, and `reversal`, along with date, method, reference, note, and who recorded it.
  - **All PG Transactions:** Open **Payments** from the main navigation menu and pick any month (`YYYY-MM`) to view PG-wide collections and refunds.
  - **Receipts Note:** PG Manager does not include a standalone printable PDF receipt button; transaction references can be shared via WhatsApp bill/payment messages or exported via monthly CSV.
- **Reversing an Incorrect Payment (`Reverse`):**
  - **Who can reverse:** The **Owner**, or Staff whose **`Can reverse payments`** toggle is turned ON in **Settings → Staff**.
  - On the **Resident → Payments** tab, click **"Reverse"** next to the transaction, enter a **Reason**, and click **"Confirm reversal"**.
  - **Protections:** Reversals append an offsetting entry (never deleting financial history). Internal checkout transfers (`method = internal`) and existing reversals cannot be reversed via UI, and a deposit payment cannot be reversed if part of it was already deducted or refunded.

---

## Section I: WhatsApp Communication

> **IMPORTANT — Manual WhatsApp Sharing Only:**
> This edition uses **manual WhatsApp sharing only** (`wa.me` web/app links). **PG Manager never sends WhatsApp messages automatically.** You click **Open WhatsApp**, review/send the message yourself inside WhatsApp, and return to click **Mark as sent**. Clicking **Mark as sent** records staff confirmation—it is **not** a delivery receipt from WhatsApp.

### Who Can Send WhatsApp Messages
- The **Owner**, plus any **Staff** member with **`Can send WhatsApp`** enabled in **Settings → Staff**.

### 1. Sending to One Resident (`Resident → WhatsApp`)
1. Open the resident's profile and click **"WhatsApp"**.
2. Choose an active **Template** from the dropdown. PG Manager automatically fills resident details (`{name}`, `{balance}`, `{due_date}`, `{bill_breakdown}`, etc.).
3. Edit the pre-filled message text directly in the text box if desired.
4. Click **"Open WhatsApp"**. WhatsApp Web or the WhatsApp app opens with the message pre-filled for that resident's mobile number.
5. Send the message inside WhatsApp, return to PG Manager, and click **"Mark as sent"**.
   - **Send-Status Rule:** **"Mark as sent"** stays disabled until you click **"Open WhatsApp"** at least once.
   - **Overdue Cooldown Guard:** Only templates categorized as **Overdue** enforce the **Minimum days between overdue reminders** cooldown configured in **WhatsApp → WhatsApp settings** (default `3` days). If an overdue reminder was sent recently, the button stays disabled and shows how many days remain. Templates in other categories (**Rent**, **Deposit**, **Payment**, **Announcement**, **Maintenance**, **Custom**) do not block sending.

### 2. Sending in Bulk via Manual Queue (`/whatsapp → Send messages`)
Use the **WhatsApp** page to message an entire group cleanly without losing track of who was already messaged:

1. **Set Filters & Template:**
   - **1. Billing month:** Month whose bill breakdown and payment status to use.
   - **2. Branch** & **Room (optional)**.
   - **Recipients:** Choose from 8 built-in segments:
     - `All active residents`
     - `Rent unpaid (incl. partial)`
     - `No rent payment received`
     - `Partially paid rent`
     - `Fully paid rent`
     - `Overdue rent`
     - `Pending security deposit`
     - `Joined this month`
   - **3. Template:** Pick any active template.
2. Click **"4. Show matching residents"**.
   - **Eligibility Check:** Residents without a valid 10-digit Indian mobile number (10 digits starting with `6–9`, optionally prefixed with `91` or `0`) cannot be selected (`"No valid WhatsApp number"`).
   - **Duplicate Prevention Warning:** If a resident was already confirmed sent the *same template* for the *same month*, they are tagged **`Sent before`** (with **`(balance changed)`** noted if their pending balance changed since last sent).
   - Click any truncated message in the **Message** column to preview the full text for that resident.
   - Use checkboxes or **Select all / Deselect all** to finalize your recipient list.
3. Click **"5. Review & start sending (N)"**. If any selected residents were previously messaged that month, tick the **`Share again`** confirmation box, then click **"Start"**.
4. **Work Through the Manual Queue One Resident at a Time:**
   - PG Manager displays one active resident at a time (`Recipient 1 of N`) with a progress bar (`sent · skipped · failed · left`):
     - **Open WhatsApp** (changes to **Open again** after opening): Opens WhatsApp in a new tab/window.
     - **Mark as sent:** Enabled *only after* **Open WhatsApp** is clicked; marks sent and advances to the next resident. *(Final status—cannot be undone.)*
     - **Skip:** Skips this resident for now (can **Retry** later while session is active).
     - **Didn't open:** Marks as `Failed to open` if WhatsApp failed to launch (can **Retry** later).
     - **Pause / Resume:** Pause anytime, close the browser, and resume later from **WhatsApp → History** (`Continue`).

> **[Screenshot Placeholder — WhatsApp Manual Send Queue]**  
> *Shows progress bar (`processed of total`, `sent · skipped · failed · left`), current resident card with phone `+91...`, pre-rendered message box, "Open WhatsApp", "Mark as sent", "Skip", "Didn't open", and numbered recipient status list below.*

### 3. Managing WhatsApp Templates (`WhatsApp → Templates` — Owner Only)
PG Manager ships with **4 active default templates**: `Rent Reminder`, `Overdue Payment`, `Pending Deposit`, and `General Announcement`.
- **Owner Controls:** Click **New template**, **Edit**, **Deactivate** / **Activate**, or **Archive** / **Restore**. *(Staff can view/use active templates but cannot create or edit them.)*
- **Template Rules:**
  - Title up to **80 characters**; Message body up to **4,000 characters**.
  - Select a **Category** (`Rent`, `Overdue`, `Deposit`, `Payment`, `Announcement`, `Maintenance`, `Custom`). *(Category determines how quick-sends are logged and whether the overdue cooldown applies.)*
  - Clickable variable chips insert placeholders safely:
    `{name}`, `{pg}`, `{room}`, `{bed}`, `{rent}`, `{balance}`, `{current_balance}`, `{previous_balance}`, `{deposit_balance}`, `{month}`, `{due_date}`, `{bill_breakdown}`.
  - Unknown `{placeholders}` or unmatched `{` / `}` braces are rejected with an error message before saving.
  - Editing or archiving a template never alters earlier sent history snapshots.

### 4. WhatsApp History & Cooldown Settings (`History` & `WhatsApp settings`)
- **History Tab:** Filter sessions by **From / To** dates, **Branch**, **Template**, **Status**, and **Method** (`Manual WhatsApp` or `Historical automated` read-only logs). Staff cannot view sessions containing residents outside their assigned branches.
- **Resident Messages Tab Privacy:** On a resident profile's **Messages** tab, the **Owner** sees full message texts; Staff see an 80-character preview (`"Only the owner can view the full message."`).
- **WhatsApp settings Tab (Owner Only):** Set **Minimum days between overdue reminders** (`1` to `60` days; default `3` days) and click **Save**.

---

## Section J: Resident Changes

### 1. Editing Personal Details, Guardian Info & Deposit Agreed (`Resident → Edit`)
1. Open the resident's profile and click **"Edit"**.
2. Update **Name**, **Mobile**, **Alternate mobile**, **Deposit agreed (₹)**, **Guardian** fields, **ID proof** fields, or **Notes**.
3. **Owner ID Verification:** The Owner can update **ID verification** status (`Pending`, `Verified`, `Rejected`). Staff can view it but cannot change it.
4. Click **"Save"**.
   - *ID Switching Rule:* If a private document file is currently uploaded, you must first **Delete** that file from the **Private ID document** section before switching ID proof method back to `"Enter ID number"` or `"Not collected yet"`.

### 2. Changing Rooms, Beds or Branches (`Resident → Change room`)
1. On an **active** resident's profile, click **"Change room"**.
2. Select **New bed** from any currently vacant bed across your accessible branches.
3. Choose **Move date** (cannot be before their current bed start date).
4. Adjust **New monthly rent (₹)** (pre-filled from the selected bed's rent rate).
5. Click **"Move"**.

#### Billing & Access Implications of a Room Change
- **Current Month's Bill Stays Unchanged:** PG Manager does not automatically split or change this month's rent bill upon moving rooms. As noted in the dialog: *"This month's bill stays as is. Add an adjustment if needed. New rent applies from next month."* Use **Charge / discount** to add an adjustment or discount if prorating mid-month difference.
- **Vacancy & Room History:** The old bed becomes **Vacant** immediately, and the **Room history** tab records both allocations cleanly (`start_date → end_date`).
- **Revising Monthly Rent Without Moving Rooms *(Limitation Note)*:** The current UI does **not** have a standalone *"Edit current monthly rent"* button inside **Edit resident**. Rent on the resident's active allocation is updated via **Change room** (which shows vacant beds only) or accommodated per month via **Charge / discount** (Adjustment/Discount) or Owner rent-line reversal + adjustment. *(Flagged for workflow verification if mid-stay rent increases in the same bed are frequent.)*
- **Cross-Branch Move Staff Access Note:** If you move a resident from Branch A to Branch B, staff members who only have access to Branch A (or only Branch B) will no longer be able to open that resident (`"This resident has history in another branch. Ask the owner for access."`), because mixed-branch financial history requires access to *all* branches in the resident's history.

---

## Section K: Resident Checkout

Before checking a resident out, verify whether they still owe a balance you plan to collect in cash/UPI **outside** the security deposit—and note whether any partial-month discount or room EB charge should be added first.

### Step-by-Step Checkout Workflow
1. Open the active resident's profile and click **"Checkout"** (red button).
2. Set **Checkout date** (cannot precede the current bed's start date).
   - *No Automatic Proration:* PG Manager bills full monthly rent when due. If you want to waive unused days, cancel checkout first, add a **Discount** under **Charge / discount**, and then return to **Checkout**.
3. **Add Deposit Deductions (Optional):**
   - Click **"+ Add deduction"**, enter the **₹** deduction amount and a clear **Reason** (e.g., `Room painting`, `Key replacement`, `Cleaning`). You can add multiple deduction rows.
   - Total deductions cannot exceed the resident's **Deposit held**.
4. **Apply Remaining Deposit to Dues:**
   - Leave **"Use deposit to clear pending dues"** checked (default) to automatically deduct remaining deposit toward unpaid rent/charges. Uncheck it if the resident will pay dues separately and receive full deposit refund.
5. **Review the Settlement Summary Card:**
   - **Deposit held**
   - **Deductions** (`−₹...`)
   - **Pending dues**
   - **Deposit used for dues** (`−₹...`)
   - **Refund to resident** (remaining deposit + any advance/credit)
   - **Still owed by resident** (shown in red if pending dues exceed available deposit)
6. Check **"I confirm these amounts. The bed will be freed."**
7. Click **"Confirm checkout"**.

> **[Screenshot Placeholder — Resident Checkout Summary]**  
> *Shows Checkout date, "+ Add deduction" rows, "Use deposit to clear pending dues" checkbox, live settlement summary card (Deposit held, Deductions, Pending dues, Deposit used for dues, Refund to resident, Still owed), confirmation checkbox, and "Confirm checkout" button.*

### Step 2: Recording the Refund Payout (`Record refund`)
- **Important:** Clicking **Confirm checkout** calculates the **Refund to resident** and transfers deposit to dues internally, but it does **not** automatically log the cash/UPI/bank payout to the resident.
- Once checked out, if any **deposit held** or **advance / credit** remains refundable, a **"Record refund"** button appears on the resident's profile header:
  1. Click **"Record refund"**.
  2. Choose **From**: **Deposit** (max remaining deposit held) or **Advance / credit** (max remaining rent credit). *(If the resident has both remaining deposit and advance credit, record one refund per account.)*
  3. Enter **Amount**, **Method** (`Cash`, `UPI`, `Bank`), **Reference**, and **Date**, then click **"Record ₹..."**.

### Important Checkout Edge Cases
- **Collecting Remaining Dues After Checkout:** Once a resident is marked `Checked out`, the **"Collect payment"** button is hidden on the resident profile UI. **Therefore, if "Still owed by resident" is above ₹0 and the resident pays it on departure day, collect that payment *before* clicking Checkout** (or adjust/settle beforehand).
- **Post-Checkout Room EB:** If the Owner finalizes a Room Electricity Bill later for the month the resident stayed, that resident's share becomes a **Pending checkout reconciliation** item inside the Room EB modal rather than changing past checkout entries.

---

## Section L: Reports & Exports

PG Manager provides focused operational reports, CSV export, and filterable audit views:

| Feature / Report | Location | Available Filters | Export / Output |
| :--- | :--- | :--- | :--- |
| **Monthly Payments & CSV Export** | **Payments** (`/payments`) | Month (`YYYY-MM`) | Cards: **Rent collected (net)**, **Deposits (net)**, **Refunds paid**; full monthly ledger list; **"Export CSV"** button downloads `payments-YYYY-MM.csv` (spreadsheet-formula protected). |
| **Occupancy & Overdue Summary** | **Dashboard** (`/dashboard`) | Branch (`All branches` or specific branch) | 4 KPI cards, **Overdue residents** list (top 50), and **Rent collected (6 months)** bar chart (on-screen view). |
| **Resident Dues Directory** | **Residents** (`/residents`) | Search (name/mobile/code/room), Status (`Active`/`Checked out`/`All`), Branch, Payment (`Has dues`/`Fully paid`/`Bill not shared`) | On-screen filterable ledger table with pending dues & advance credit indicators. |
| **WhatsApp Send History** | **WhatsApp → History** (`/whatsapp`) | Date range (`From` / `To`), Branch, Template, Status, Method | Session summary table with Sent / Pending / Skipped / Failed counts and full recipient snapshots. |
| **Room EB History & Audit** | **Rooms → Electricity bill** | Room, Billing month | Past finalized/draft totals, per-resident shares, and checked-out liability reconciliation statuses. |

> **Verification Note — What Is Not Built In:**
> - PG Manager does **not** include a one-click *"Download full database backup"* button inside the web UI, a CSV export button on the **Residents** page, or a printable PDF rent receipt generator.
> - **Recommended Monthly Routine:** Open **Payments** on the 1st of every month for the previous month and click **"Export CSV"** to archive monthly financial transactions in your own bookkeeping folder, alongside your hosting provider's PostgreSQL backups.

---

## Section M: Staff Management & Settings (Owner Only)

The **Settings** section (`/settings`) is strictly restricted to the **Owner**.

### 1. Creating & Managing Staff (`Settings → Staff`)
1. **Add New Staff:**
   - Fill **Name**, **Email**, and **Password (min 8)**.
   - Tick one or more **Branch** checkboxes to grant access.
   - Optionally toggle **Can send WhatsApp**.
   - Click **"Add staff"**.
2. **Manage Existing Staff Permissions & Status:**
   - **Branch Checkboxes:** Grant or revoke access per branch in real time. *(Staff with zero branches see nothing; staff cannot view residents whose history spans branches they don't have access to.)*
   - **Can send WhatsApp:** Controls access to the **WhatsApp** menu and **WhatsApp** button on resident pages. *(Note: Staff still see only 80-character message previews on resident Messages tabs and cannot edit templates or overdue gap settings.)*
   - **Can reverse payments:** Allows staff to click **Reverse** on payment transactions (`money_txns`). *(Even without this toggle, staff with branch access can reverse non-rent extra charges/discounts/adjustments; only the Owner can reverse monthly rent lines or finalize Room EB.)*
   - **Active Switch:** Turning **Active** OFF immediately signs that staff member out and blocks future logins without deleting audit history (`by_name` stays intact).
   - **Reset password:** Click **"Reset password"** next to a staff member and enter a new password (min 8 chars) to reset their password and immediately invalidate their active sessions.

| Capability / Action | Owner | Staff |
| :--- | :--- | :--- |
| View Dashboard, Rooms, Residents, Payments (scoped to assigned branches) | All branches | Assigned branches only (requires ≥1 branch) |
| Onboard residents, collect payments, move beds, checkout | Yes | Yes (assigned branches) |
| Manage Branches, General Settings, Staff, Owner Recovery Code | **Yes** | No |
| Create/Edit WhatsApp Templates & Overdue Cooldown | **Yes** | No |
| Send Manual WhatsApp Messages | **Yes** | Only if **Can send WhatsApp** = ON |
| View full message body in Resident Messages history (>80 chars) | **Yes** | No (80-char preview only) |
| Reverse payment transactions (`money_txns`) | **Yes** | Only if **Can reverse payments** = ON |
| Reverse a `Monthly rent` bill line | **Yes** | No |
| Verify/Reject Resident ID Status (`Edit → ID verification`) | **Yes** | No |
| Room-wise Electricity Billing (`Electricity bill` / `Finalize` / `Reconcile`) | **Yes** | No |

### 2. General PG Settings (`Settings → General`)
- **PG name**, **Phone**, **Address**
- **Monthly rent due day (`1–28`):** Controls rent due dates and whether extra charges fall on the current or next month's bill.
- **Timezone:** Ensures PG dates (`today`), bill months, and due checks run on your PG's local clock (`Asia/Kolkata` by default), regardless of browser or server location.
- **Update database structure:** Safe, idempotent button for the Owner to run **once after an application software update** to ensure any new tables or constraints exist. Click **Save** after changing fields above.

### 3. Security Tab (`Settings → Security`)
- Shows whether an Owner recovery code exists and when it was created.
- Allows the Owner to enter **Your current password** and click **"Create a new recovery code"** at any time.

---

## Section N: Troubleshooting

| Issue / Symptom | Likely Cause | How to Resolve |
| :--- | :--- | :--- |
| **Owner forgot password** | Password forgotten | Click **Forgot password?** on `/login`, enter Owner Email + saved 24-character Recovery Code + new password, and save the **new** recovery code shown afterward. |
| **Staff member forgot password** | Staff do not have recovery codes | Ask the **Owner** to open **Settings → Staff**, click **Reset password** next to the staff user, and share the new password. |
| **"Too many wrong attempts. Please wait 15 minutes..."** | 5 wrong recovery code guesses in 15 min | Wait 15 minutes, carefully verify every character of your *latest* recovery code (remember old codes expire after any reset or rotation), and retry. |
| **Staff logs in and sees "No branches assigned..."** | New staff account has no branch boxes ticked | Owner opens **Settings → Staff** and ticks at least one Branch for that staff user. Staff reloads the page. |
| **"Wrong email or password."** | Typo, Caps Lock, or deactivated user | Check email spelling, use the eye icon to verify password, or ask Owner to check **Settings → Staff → Active** toggle. |
| **Missing monthly rent bill for a resident** | Resident joined in future month, or page needs bill sync | Verify **Joining date** under resident details; open **Payments** and click **Generate bills**. If they joined *after* the due day, check the saved due date (moves to next month's due day). |
| **Extra charge appeared on next month's bill instead of this month's** | Added after this month's PG due day | Intended behavior! If it belongs on *this* month instead, reverse that line on next month's bill (`Bills → Reverse`) and add an **Adjustment** with **Month** set explicitly to this month. |
| **Wrong rent or payment amount recorded** | Typo during entry | Financial records cannot be edited/deleted. Open **Resident → Bills** or **Payments** tab, click **Reverse**, enter a reason, and re-enter the correct amount. |
| **Document upload fails or button is disabled** | File > 4 MB, wrong format, or 1 doc already exists | Ensure file is **JPEG, PNG, or PDF** and **4 MB or smaller**. Delete any existing uploaded document (`Trash` icon) before uploading a new one. Note: upload from Resident Profile, *not* during Add resident. |
| **Room-wise EB "Finalize" button disabled** | Allocated total > room bill, or owner-borne box unchecked | Ensure total resident Final EB never exceeds **Total room EB (₹)**, and tick **"I accept ₹... as owner-borne."** if any unallocated/vacant-day amount remains. |
| **"Mark as sent" button disabled in WhatsApp** | WhatsApp not opened yet, or Overdue cooldown active | Click **"Open WhatsApp"** first. If using an Overdue template on a resident's profile, check if a reminder was sent within the cooldown gap (`WhatsApp → WhatsApp settings`). |
| **WhatsApp won't open for a resident** | Invalid mobile number or popup blocker | Verify mobile is a valid 10-digit Indian mobile (`6–9` start) under **Resident → Edit**, and allow browser popups for your PG Manager site. |
| **App shows loading error / "Couldn't load..."** | Internet disconnected or expired session | Check Wi-Fi/mobile data, click **Retry** or refresh page; sign in again if logged out. |

---

## Section O: Security & Client Handover

Before entering real resident details and live money transactions, complete these essential handover security practices:

1. **Owner-Only First-Time Setup & Recovery Vault:**
   - Have the **PG Owner** personally complete `/setup`, create their own private password, and store the 24-character recovery code in two secure places (password manager + locked paper backup).
2. **Verify Global Rules Before Adding Real Residents:**
   - Set **PG name**, **Monthly rent due day (`1–28`)**, and **Timezone** in **Settings → General**, then add real **Branches** and **Rooms/Beds** first.
3. **Least-Privilege Staff Accounts:**
   - Never share the Owner password with staff. Create individual staff accounts so every payment, charge, reversal, and WhatsApp confirmation clearly logs `by <staff name>`.
   - Assign staff strictly to the branch(es) they manage, and enable **Can reverse payments** or **Can send WhatsApp** only for trusted managers.
4. **Private ID & Aadhaar Data Hygiene:**
   - When collecting Aadhaar manually, enter the 12 digits so PG Manager saves only `XXXX XXXX 1234`.
   - When uploading private ID scans (JPEG/PNG/PDF up to **4 MB**), understand that **View** / **Download** links expire quickly (60 seconds) for resident privacy. Do not leave downloaded ID files sitting unencrypted on shared reception computers.
5. **Routine Bookkeeping Exports:**
   - Export monthly **Payments CSV** (`payments-YYYY-MM.csv`) at each month-end for external accounting backups.

---

## Quick Start Checklist (One-Page Reference)

Use this checklist on Day 1 and during your first billing cycle:

### Part 1: Day-1 Initial Setup (Owner)
- [ ] **1. Open PG Manager URL** and verify the **First-time setup** screen shows **Database connected**.
- [ ] **2. Create Owner Account:** Enter PG name, Owner name, Email, and Password (8+ chars) → click **"Create my PG"**.
- [ ] **3. SAVE RECOVERY CODE IMMEDIATELY:** Click **"Copy code"**, store in a password manager **and** write on locked paper → check **"I have saved my recovery code"** → click **"Go to dashboard"**.
- [ ] **4. Configure Settings → General:** Confirm PG Name, Phone, Address, **Monthly rent due day** (default Day `7`), and **Timezone** (`Asia/Kolkata`) → click **"Save"**.
- [ ] **5. Add Branches (`Settings → Branches`):** Create at least one active branch (`Name`, `Address`) → **"Add branch"**.
- [ ] **6. Create Rooms & Beds (`Rooms → Add room`):** Add rooms, select sharing (`Single`–`12 sharing`), AC/Non-AC, and bed rents. Fine-tune individual bed rates if needed.
- [ ] **7. Customize WhatsApp Templates (`WhatsApp → Templates`):** Review the 4 starter templates (`Rent Reminder`, `Overdue Payment`, `Pending Deposit`, `General Announcement`) and adjust wording if desired.
- [ ] **8. Create Staff Logins (`Settings → Staff`):** Add managers/wardens with their own email, password, **assigned branch checkboxes**, and optional `Can send WhatsApp` / `Can reverse payments` toggles.
- [ ] **9. Install App Shortcut:** Click **"Install PG Manager"** on your phone/desktop for one-tap access.

### Part 2: First Residents & Monthly Routine
- [ ] **10. Add First Resident (`Residents → Add resident`):** Fill mobile, choose vacant bed, joining date, monthly rent, deposit agreed, deposit paid now, guardian, and manual ID (or leave ID blank to upload scan next).
- [ ] **11. Record First Rent & Upload ID Scan:** On the new resident's profile, click **"Collect payment"** (`Rent & charges`) if they paid rent on arrival, and upload their **Private ID document** (`JPEG`/`PNG`/`PDF`, max **4 MB**). Verify ID status via **Edit → ID verification** (Owner).
- [ ] **12. Mid-Month / Month-End Charges & Room EB:**
  - Add extra utilities via **Residents → Split among X residents** or **Charge / discount** on a resident profile.
  - *(Owner only)* Open **Rooms → Electricity bill**, enter **Total room EB (₹)** → **Calculate EB** → accept vacant/owner-borne amount if applicable → **Finalize**.
- [ ] **13. Send Monthly Bills Manually on WhatsApp (`WhatsApp → Send messages`):** Choose month, branch, recipients, and `Rent Reminder` template → **Show matching residents** → **Review & start sending** → open WhatsApp per resident and **Mark as sent**.
- [ ] **14. Month-End Backup Export (`Payments → Export CSV`):** Select the completed month and download `payments-YYYY-MM.csv` for your accounting records.

---

## Password Recovery Quick Reference (One-Page Reference)

> **IMPORTANT: Save your recovery codes securely during account setup. Do not share them with staff or unauthorized individuals.**

### Keep These Rules Visible
1. **Owner Recovery Code = Single-Use Only:** After one successful password reset, the old code stops working and a **new** 24-character code (`XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`) appears once. Save the new one immediately.
2. **No Email Reset Exists:** PG Manager does not email reset links. Never close a recovery-code screen without saving the code first.
3. **Attempt Limit:** **5 failed attempts** per 15 minutes temporarily locks password resets for 15 minutes.
4. **Staff Have No Recovery Codes:** Staff must ask the **Owner** to reset their password.

---

### Scenario 1: Owner Forgot Password (Has Saved Recovery Code)
1. Go to the **Sign in** page and click **"Forgot password?"**.
2. Enter your **Owner Email** and your latest **Recovery code** (dashes/case optional; 24 characters).
3. Enter **New password (min 8)** and **Confirm new password**.
4. Click **"Set new password"**.
5. **CRITICAL:** On the **"Password changed"** screen, click **"Copy code"** and store the **brand-new replacement recovery code** immediately (delete/cross out the old code).
6. Tick **"I have saved my recovery code"** → click **"Go to sign in"** → log in with your new password. *(All other devices will be signed out.)*

---

### Scenario 2: Owner Is Signed In & Wants a Fresh Recovery Code (or Lost Old Paper Copy)
1. Sign in as **Owner** → open **Settings** → click the **Security** tab.
2. Enter **"Your current password"**.
3. Click **"Create a new recovery code"**. *(Previous code stops working immediately.)*
4. Click **"Copy code"**, save the new code securely, tick **"I have saved my recovery code"**, and click **"Done"**.

---

### Scenario 3: Staff Member Forgot Password
1. Staff member contacts the **PG Owner** directly.
2. Owner signs in → **Settings → Staff** → clicks **"Reset password"** next to that staff account.
3. Owner enters a new password (min 8 characters) and saves.
4. Staff member's old sessions are logged out; they sign in with the new password.

---

### Scenario 4: Owner Lost BOTH Password AND Recovery Code
- There is **no self-service recovery button** inside PG Manager once both the Owner password and the active recovery code are lost.
- Contact your system/database administrator for direct database-level owner recovery support.

---

### Private Owner Recovery Record *(Optional — Print This Page Only; Fill Out By Hand & Lock Offline)*
*Do **NOT** type your real recovery code into shared files, emails, or WhatsApp.*

| Field | Handwritten Record (Keep Locked Away From Staff) |
| :--- | :--- |
| **PG Manager Web URL** | `____________________________________________________` |
| **Owner Sign-in Email** | `____________________________________________________` |
| **Active Recovery Code (Date: ____/____/20____)** | `____ - ____ - ____ - ____ - ____ - ____` |
| **Previous Code Replaced? (Date)** | `[ ] Yes — replaced on ____/____/20____` |

---

## Handover Verification Summary

For transparency at client handover, the table below summarizes items verified directly from the latest PG Manager source code versus items recommended for a quick manual browser walkthrough after owner account creation:

| Area | Verification Status | Notes from Latest Codebase Inspection |
| :--- | :--- | :--- |
| **Owner setup, single-use recovery code, rotation (`Settings → Security`), rate limits & staff reset** | **Confirmed in code** | `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX` (24 chars, no `I/O/0/1`), SHA-256 salted hash, 5-attempt/15-min lockout, `Copy code` button (no file download button), staff reset via browser prompt. |
| **PWA install control & online-first service worker** | **Confirmed in code** | Tested `/manifest.webmanifest` and `/sw.js` locally; `"Install PG Manager"` button and OS/browser fallback instructions verified. |
| **Branches, Rooms, Beds (`1–12`), Occupancy & Archive rules** | **Confirmed in code** | Archive limited to empty rooms; bed rent edits affect future residents only. |
| **Resident Onboarding & 4 MB Private Document Upload** | **Confirmed in code** | Onboarding collects deposit paid (first rent is collected via `Collect payment` afterward); private ID upload (JPEG/PNG/PDF ≤ 4 MB, 1 doc per resident) lives on Resident Profile page, not onboarding form. |
| **Room-wise EB (`RoomEb`)** | **Confirmed in code** | Owner-only, splits Total Room EB (₹) daily by occupancy (no meter unit/kWh inputs), immutable after Finalize, separate post-checkout liabilities. |
| **Payments FIFO, Reversals & CSV Export** | **Confirmed in code** | FIFO bill allocation, append-only DB triggers (`Reverse` with reason), monthly CSV export on **Payments**. *(No full-DB backup button or printable PDF receipt exists.)* |
| **Manual WhatsApp Sharing, Templates & Cooldown** | **Confirmed in code** | Manual `wa.me` links only, `Mark as sent` gated behind `Open WhatsApp`, overdue cooldown applies only to `Overdue` category quick-sends; full message body restricted to Owner on resident history. |
| **Live browser check of authenticated screens & Checkout flow** | **Recommended post-setup manual check** | No live owner or resident records were created during documentation handover (`0` accounts in DB). After creating your Owner login, verify `Copy code` clipboard behavior, Staff `Reset password` prompt, ID `View`/`Download`, and checking out a test flow if desired before adding live tenants. |

