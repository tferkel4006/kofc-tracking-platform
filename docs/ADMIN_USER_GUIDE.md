# Knights of Columbus Tracking Platform — Administrator Operations Manual

**Audience:** Council Admins, Super Admins, council officers, Treasurers and Financial Secretaries.
**Covers:** the desktop portal's management screens: planning, roster, meetings, audits, ledger, lookups, donations, executive summaries and the annual budget.

> Administrators volunteer too. For signing up, logging hours and taking donations on the phone, see [MEMBER_USER_GUIDE.md](MEMBER_USER_GUIDE.md).

---

## Contents

1. [Roles and what each one sees](#1-roles-and-what-each-one-sees)
2. [Choosing the council you are working on](#2-choosing-the-council-you-are-working-on)
3. [Building multi-day events](#3-building-multi-day-events)
4. [Copying an event as a twin](#4-copying-an-event-as-a-twin)
5. [The member roster and the trade skills drawer](#5-the-member-roster-and-the-trade-skills-drawer)
6. [Meetings](#6-meetings)
7. [Executive audits: no-shows and shifts awaiting hours](#7-executive-audits-no-shows-and-shifts-awaiting-hours)
8. [The post-event ledger and lessons learned](#8-the-post-event-ledger-and-lessons-learned)
9. [Configuring council lookups](#9-configuring-council-lookups)
10. [The donations workspace](#10-the-donations-workspace)
11. [Interpreting the executive scorecard (monthly summaries)](#11-interpreting-the-executive-scorecard-monthly-summaries)
12. [Annual budget projections](#12-annual-budget-projections)
13. [Super Admin: system lookups and councils](#13-super-admin-system-lookups-and-councils)
14. [Data protection rules](#14-data-protection-rules)
15. [Administrator troubleshooting reference](#15-administrator-troubleshooting-reference)

---

## 1. Roles and what each one sees

The sidebar is folded into six groups: **Self-Service Hub** (always open: Member Actions Hub, My Expense Reports, Propose Charity Grant, Charitable Intake Sheet), **Executive Action Desks** (FS Expense Audit, GK Expense Authorize, Charity Vetting Queue, Annual Cadence Manager and Live Meeting Console), **Fraternal Analytics Hub** (Executive Dashboard, Financial Dashboard, General Ledger Spreadsheet, Balance Sheet; read by every seated officer), **Fraternal Scheduler** (calendar, events, meetings, activities, the Post-event Ledger, nominations, the photo gallery and the Lessons Registry), **Financial Ledgers** and **Administrative Lookups**. Select a group's heading to open or close it; the group holding the page you are on opens by itself, and the portal remembers your choices in this browser. Every group but Executive Action Desks shows only the sections your role can use, and a group with nothing for your role is not shown. Executive Action Desks lists every desk: one your role cannot open carries a gold **Locked** badge, and pointing at it says who holds it. **My Profile** is in the member menu: select your name and photo at the top right. **Online Help Center** is the **Help** link (question-mark icon) at the top right, just left of the alert bell. Everyone sees Member Actions Hub, Post-event Ledger, My Expense Reports, My Profile and Online Help Center. The header's **Messaging** menu (envelope icon) holds **Council Messages & Alerts** and **My Distribution Lists** for every member. On My Distribution Lists, members build private lists that only they can see; as an Admin you also get the **Reach** control, which makes a list **Council-wide** so the whole council can see it.

Expense reports are approved by two signatures (Sprint 5Z-4). On the **FS Audit Desk** the council's **Financial Secretary** audits each submitted report's receipts and presses **📜 Issue Written Order**. The report then moves to the **GK Authorization Desk**, where the **Grand Knight** presses **✍️ Counter-Sign Voucher**, which approves it and releases it to the Treasurer. A Super Admin may sign either line, but never both lines of the same report: the officer who issued the order sees the counter-sign button locked with a **🔒 Collusion Guard** tag. Council Admins can open both desks to follow the work, but only the seat holders (or a Super Admin) sign. The **Leadership Auditing Queue** shows where every submitted report stands and is where leadership uses **Reject & Return**; returning a report clears its signatures. Expense checks are issued only by the council's **Financial Secretary** or **Treasurer**, or a Super Admin. **Bulk Check Disbursements** lists only reports that carry both signatures, and the system refuses to pay any other. An Admin without a finance role does not see it. Nobody, a Super Admin included, may sign or pay an expense report they submitted.

| Section | Member | Officer | Treasurer / Fin. Secretary | Admin | Super Admin |
|---|:-:|:-:|:-:|:-:|:-:|
| Member Actions | ✔ | ✔ | ✔ | ✔ | ✔ |
| System lookups | | | | | ✔ |
| Councils | | | | | ✔ |
| Council lookups | | | Donation lookups only | ✔ own council | ✔ any council |
| Parishes & pastors, Member roster, Activities catalog | | | | ✔ own council | ✔ any council |
| Event planner | | | | ✔ | ✔ |
| Meeting center | | ✔ own council | | ✔ | ✔ |
| Distribution lists | | | | ✔ | ✔ |
| Donations | | | ✔ own council | ✔ | ✔ |
| Post-event ledger | Owners of an event | Owners of an event | Owners of an event | ✔ | ✔ |
| Lessons registry | | | | ✔ (read all councils) | ✔ |
| Executive Summaries | | | Monthly summary only | ✔ incl. audits | ✔ incl. audits |
| Annual Budget Projections | Read own council (edit if Budget Director) | Read own council | ✔ own council | ✔ own council | ✔ any council |

Key points:
- **Admins act only on their own council.** Super Admins act on any council.
- **Treasurers and Financial Secretaries** have Admin-level access to their own council's **donations**, **donation lookups** and **monthly summaries**. The personnel audits, which name members and their no-show reasons, remain for Admins and Super Admins only.
- **Officers** (any role flagged *Officer*) may schedule meetings, invite members and upload minutes for their council.
- An **event's owner** may record that event's post-event results and lessons, even as an ordinary member.
- These rules are enforced by the data service as well as the screens. A refused action shows a message and **changes nothing**.

![Image: Admin Sidebar By Role]

---

## 2. Choosing the council you are working on

Most management screens have a **Council** selector at the top:
- **Admins** see their own council.
- **Super Admins** can switch to any council.

The navy header always shows the council you belong to, next to your name, member type and officer status.

---

## 3. Building multi-day events

**Path:** sidebar → **Event Planner**

The planner is a split screen: the event list is on the left, and the selected event is on the right.

### 3.1 Create the event

1. Select **New event**.
2. Fill in **Event details**:

| Field | Notes |
|---|---|
| **Event name** | Up to 100 characters. |
| **Description** | What volunteers should know. |
| **Starts / Ends** | An event may span several days. **Ends** cannot be before **Starts**. |
| **Location** | Where volunteers report. |
| **Category** | For example Fellowship, Service, Faith Building or Fundraising. Categories drive the reports and the lessons registry. |
| **Owner** | A member of the roster. *"The owner may also record the post-event results."* |
| **Budget ($)** | Optional. Planned spend. |
| **Planned attendees** | Optional. Expected community turnout. |
| **Councils sharing this event** | Tick every council co-hosting the event. Its shifts will appear in each of those councils' shift feeds. At least one council is required. |

3. Save. You will see *"Event created. Add its shifts below."*

### 3.2 Add shifts

In the **Shifts** panel, fill in the top **New shift** row and select **Add shift**:
- **Shift name** and optional description.
- **Date:** it must fall **inside the event's dates**.
- **Start and end time.**
- **Volunteers needed:** the minimum number of volunteers. When this many members have signed up, the shift **locks automatically**.

Repeat for each day and time slot of a multi-day event.

**Shift status pills**

| Pill | Meaning |
|---|---|
| **Full** (navy) | Locked. No more sign-ups. |
| **Needs *n* soon** (red) | Within 48 hours and still short of volunteers. |
| **Needs *n*** (gold) | Priority: nobody has signed up yet, or the shift starts within 7 days. |
| **Needs *n*** (outline) | Open, with time to fill. |

To change or remove a shift, use **Edit** (then **Save** or **Cancel**) or **Delete** (then **Confirm delete** or **Keep**). A shift that members have signed up for or logged time against cannot be deleted (see §13).

![Image: Event Planner Split Screen]

![Image: Shift Grid]

---

## 4. Copying an event as a twin

Use this for recurring projects such as a monthly pancake breakfast or an annual Tootsie Roll drive.

1. Open the past event in the **Event Planner**.
2. In the **Copy as a twin** panel:
   - **New event name:** defaults to the same name. Change it if needed, for example to add the month.
   - **New first day:** the twin's start date.
3. Select **Copy event**. You will see *"Copied. The twin is open on the right."*

| Copied | Not copied |
|---|---|
| Description, location, category, owner, budget, planned attendees | Sign-ups |
| Council links | Logged hours |
| Every shift, **moved by the same number of days** so the pattern is kept (a Friday–Sunday event stays Friday–Sunday) | Post-event results (spend, funds, attendees, highlights) and lessons |

After copying, review the twin's shifts and adjust anything that changed.

![Image: Copy As Twin]

---

## 5. The member roster and the trade skills drawer

**Path:** sidebar → **Affiliated Roster**

### 5.1 Finding members

- **Search:** by name, email or member number.
- **Status:** filter by Active, Inactive and so on.
- The panel title shows *"Members (shown of total)"*. If nothing matches: *"No members match. Clear the search or status filter."*

### 5.2 Adding and editing members

1. Select **Add member** and complete the form. **Email (also the login)** is the address the member will use to onboard.
2. Save. You will see *"Added *name*. A welcome email with sign-in instructions was queued."* The member then follows the phone onboarding in the member guide.
3. **Member type:** Admins may grant *Admin* or *Member*. Only a Super Admin may grant *Super Admin* or change a Super Admin's type or status.
4. Admins cannot move a member to another council.
5. **Designated Budget Director:** the gold-bordered checkbox on the member form, shown only to the council's Admins and Super Admins. It lets the member prepare the council's annual budget (§12). Members cannot tick it on their own record.

### 5.3 The trade skills drawer

When a project needs specific trades (electricians, carpenters, cooks and so on):

1. Select **Skills** next to the council selector. The **Council skills** drawer opens.
2. Every skill recorded in the council is listed with the number of members who hold it.
3. Choose a skill to see **Members with *skill***.
4. Optional: write a note under **Message everyone with *skill*** and select **Send to *n* members**.
   - Only **active** members are messaged, and you are never included.
   - Replies arrive in the **Communications Hub**.

If the drawer says *"No member of this council has recorded a skill yet,"* ask members to add their skills under **My Profile**. You can also edit a member's skills and training for them from their record (**Skills & training**).

![Image: Skills Filter Drawer]

---

## 6. Meetings

**Path:** sidebar → **Meeting Center** (Admins, Super Admins and council officers)

1. Select **New meeting** and fill in **Meeting name**, **Type**, **Date**, **Location**, **Starts**, **Ends**, **Description** and **Agenda**.
   - **Type** lists your council's own meeting types. Choosing one fills **Agenda** with your council's template for that type (see below). You can still edit the agenda for this meeting. If you already typed your own agenda, it is kept, and a **Use the template** button offers the template instead.
   - Tick **Multi-Day Assembly / Extended Event** for a meeting that runs over several days. The **Starts** and **Ends** times disappear and an **End date** appears. The meeting then shows on the calendar across each of its days, with no times. A multi-day assembly adds no meeting hours to members' totals.
2. **Invite:** choose **All active members**, **Officers only** or **Choose members…**. Invited members get a message in the app.
3. Select **Schedule meeting**. You will see *"Meeting scheduled and invitations sent."*
4. **Minutes:** open the meeting and select **Upload minutes** (or **Replace minutes**). Members can then read them from their phones.
5. **Invitations and attendance:** tick who attended and save. This feeds each member's meeting-hour totals. If members joined the council after the meeting was scheduled, select **Invite all active members** to invite every active member who is missing.

Officers see **Take attendance** on each meeting on their phone's Home tab. Members answer their invitations from the phone's **Meetings** tab with **👍 Count Me In**.

### 6.1 Meeting agenda templates

**Path:** sidebar → **Council Lookups** → **Meeting Agenda Templates** (Council Admins, the Grand Knight and Super Admins)

1. Pick a **Meeting type**.
2. Write the **Default agenda outline** that meetings of this type should start from, then select **Save template**.
3. To remove a template, clear the text and save.

Each council keeps its own templates. The **Event** form has the same **Multi-Day Assembly / Extended Event** box: leave it unticked for a one-day event, which then ends the day it starts.

For who may do what across the platform, see the [Role Permissions Matrix](ROLE_PERMISSIONS_MATRIX.md).

![Image: Meeting Center]

---

## 7. Executive audits: no-shows and shifts awaiting hours

**Path:** sidebar → **Executive Dashboard Summaries** → **Executive audits**. These audits are for the council's Admins and Super Admins only.

### 7.1 No-show audit (last 6 months)

This panel lists every sign-up flagged as a no-show by members of the council **on shifts in the trailing 6 months**, newest first.

| Column | Use |
|---|---|
| Member / Member # | Who missed the shift. |
| Shift date, Event, Shift | Which commitment it was (with the shift number, for reference). |
| Reason | The reason code and description, for example *Forgot* or *Wrong Time*, or a red **No reason provided** pill. |

- The header's red pill counts **no-shows without a reason**. Follow up on these first.
- Members see their own rolling **12-month** badge on the phone. The 6-month audit is the council's working view.
- No-show reasons come from the **No-Show Reason** system lookup (§12).
- No-shows are recorded on the **Post-event Ledger** turnout grid (§8), or by members reporting their own absence on the phone.
- Meeting absence is recorded by leaving **Attended** unticked in the Meeting center. Meetings have no separate no-show flag.

### 7.2 Shifts awaiting hours

This panel lists members who signed up for a past shift, were **not** marked as no-shows, and have **not logged hours** yet.

| Column / marker | Meaning |
|---|---|
| **Phone** | So you can follow up personally. |
| **Days since** | Days since the shift. It turns red from day 5. |
| **First reminder on day 5** | Still within the grace period. |
| **⚠ Overdue** | Day 5 or later. Shows how many text reminders have been due so far, and the **log by** date. |
| **Closed: past 3 months** | The logging window has closed and the hours can no longer be recorded. |

- **Reminder cadence:** the first text goes out on **day 5**, then **once a week**, and reminders stop once the shift is more than 3 months old.
- The header's red pill counts the rows that are past day 5.

![Image: Executive Audits]

---

## 8. The post-event ledger and lessons learned

**Path:** sidebar → **Post-event Ledger**. This is open to Admins for their councils' events, and to each event's owner.

1. The left list has two tabs:
   - **Active queue:** events waiting for results, marked **Results needed**.
   - **Historic archive:** events with results, marked **Recorded**.
2. Choose an event and fill in **Results**:
   - **Spend ($)** and **Actual attendees**.
   - **Cash raised ($)** and **Electronic raised ($)**. Once cash or electronic donations have been recorded for the event, these fields show **Synced from donations** and are read-only, because the donations are the source of truth. Physical items never count toward these totals.
   - **Highlights:** short notes that appear on the monthly executive summary.
3. Select **Save results**. You will see *"Results saved."*
4. **Fraternal Volunteer Turnout Summary** lists every volunteer, their shift, their logged hours (**—** if none) and their no-show status, with a total.
   - **Mark no-show:** select it on the volunteer's row, choose the reason from the **No-Show Reason** list, and select **Confirm** (or **Cancel**). The row gets a red edge and a **No-show** pill with the reason.
   - **Clear:** removes a no-show recorded in error.
   - Admins mark and clear no-shows on events linked to **their own council**; Super Admins on any event. Rows where the volunteer has **Hours logged** cannot be marked.
   - Members may report their own absence from their phone, but only an Admin or Super Admin can clear a no-show.
5. **Lessons learned:** choose a **Category**, write **What did we learn?**, and select **Add lesson**.

### 8.1 Lessons registry

**Path:** sidebar → **Lessons Registry** (Admins and Super Admins)

Search lessons across **every council**:
- Filter by text, event dates, councils, event categories and lessons categories.
- The newest events are listed first.
- Lessons from your own council's events are **marked in gold**. You change them on the post-event ledger, not here.

![Image: Post Event Ledger]

---

## 9. Configuring council lookups

**Path:** sidebar → **Council Lookup Tables**

| Tab | Who | Columns |
|---|---|---|
| **Activities** | Admins, Super Admins | Activity name, Description, Category |
| **Donation types** | Admins, Super Admins, Treasurer, Financial Secretary | Donation type (for example *General Fund*, *Coats for Kids*) |
| **Enabled donation methods** | Admins, Super Admins, Treasurer, Financial Secretary | Method, **QR code image URL** |
| **Budget categories** | Admins, Super Admins, Treasurer, Financial Secretary | Budget category (fund) the annual budget is grouped under (§12.3) |

- Edit rows in place. Changed rows are marked **Edited**.
- **Changes are saved together:** select **Save changes**. If any row is refused, **none** are written, so fix the reported row and save again.
- **Enable a QR method** (Venmo, Zelle, Zeffy, ParishSoft) by adding it and pasting the link to the council's QR image. Until a link is saved, members see *"Your council has not uploaded this QR code yet."*
- Activities belong to one council and are **not shared** with sister councils.
- Finance officers see only the two donation tabs and **Budget categories**.
- A budget category cannot be deleted while budget lines are filed under it. Move those lines to another category first.

![Image: Council Lookups]

---

## 10. The donations workspace

**Path:** sidebar → **Recorded Donations History** (Admins, Super Admins, Treasurer, Financial Secretary)

- **Event donations** summarises each event's donations as **Cash**, **Electronic** and **Items (est.)**. Events whose ledger is driven by donations show **Ledger synced from donations**.
- **Standalone donations** lists donations not tied to any event.
- **Record a donation:** choose the **Method**, **Type**, **Amount** (or **Estimated value ($)** for physical items), **Date** and **Event** (or *Standalone (no event)*). Optionally add the **Donor**, a **Description** (required for physical items) and a **Photo link**.
- **Correcting or deleting a donation:** allowed for the member who recorded it, the event's owner, and the council's finance officers, Admins and any Super Admin. A donation's council and its recorder cannot be changed.
- Event donations must be dated **on or after the event's start**.

![Image: Donations Workspace]

---

## 11. Interpreting the executive scorecard (monthly summaries)

**Path:** sidebar → **Executive Dashboard Summaries**. Choose the **Month** and **Year**.

### 11.1 Scorecard tiles

| Tile | What it measures |
|---|---|
| **Total labor hours** | Hours logged on the council's event shifts plus its activities in the month. |
| **Unique Knights participating** | Distinct members who logged any shift or activity time in the month. |
| **Net balance** | Funds raised (cash + electronic) minus spend, for the month's events. |
| **Community outreach** | Actual attendees across the month's events. |

### 11.2 Financial ledger

*"Ledger for *Month Year*"*: **Cash raised**, **Electronic raised**, **Total raised**, **Spend** and **Net balance**, all taken from the post-event results. Figures are summed to the cent.

### 11.3 Monthly highlights

The **Highlights** text of each of the month's events, in date order. If none appear, add them in the post-event ledger.

### 11.4 Reading the numbers

- **Low hours but many unique Knights?** Participation is wide but shallow. Consider longer or more shifts.
- **A negative net balance** is normal for service events with no fundraising. Check it against the event's budget.
- **Numbers look low early in the month?** Hours arrive as members log them (up to 3 months later for shifts). Re-check after the reminder cycle.

### 11.5 Budget tracking gauges

Admins, Treasurers, Financial Secretaries and Super Admins see a **Budget tracking** panel under the scorecard tiles, for the fraternal year of the chosen month (July – June).

- A **Whole budget** gauge, then one gauge per budget category with an approved cap or any spend, compare actual spend so far with the category's **approved** budget. Spend counts exactly what the monthly summaries count: event spend, approved and reimbursed expenses, and charity checks.
- Gauges fill navy while on track, turn gold with a pulsing **⚠ 85%+ of cap** tag from 85% of the cap, and red with **⚠ Over budget** past 100%. A thin red mark on each gauge shows the 85% line.
- **Unbudgeted spend** (one-off events, expenses not linked to an event or meeting, charities without a budget line) is shown under the gauges.
- Until the council approves and finalizes the year's budget (§12.6) there are no caps, so the panel shows only the spend to date.

![Image: Executive Scorecard]

---

## 12. Annual budget projections

**Path:** sidebar → **Financial Ledgers** → **Annual Budget Projections**. Every member can open it.

- **Every member of the council can read the budget.** Members without edit rights see the same spreadsheet as plain text, marked **Transparency view** and **Read only**, with no input boxes, rollup button or custom-line form.
- **The budget is prepared** by the council's Admins, Treasurer and Financial Secretary, its **Designated Budget Director**, and Super Admins.
- **Designated Budget Director:** a council Admin or a Super Admin ticks **Designated Budget Director** on the member's record in the **Affiliated Roster** (§5.2). That member can then prepare their own council's budget. Untick it to withdraw the delegation. The member must sign in again for the portal to show their new controls.

> **The Annual Forecasting Tag System**
>
> The **Is Annual** checkbox on the **Event** form (Event Planner) and on a **Global Charities Registry** entry is a **financial accounting tag only**.
>
> - It does **not** duplicate calendar cards, copy the event, or create any future schedule entries. Next year's edition of an event is still planned in the Event Planner (for example with **Copy as twin**, which keeps the tag).
> - It tells the Budget Engine which events and charities recur each year. When the budget is prepared, the engine reads the **prior fraternal year's actual audited spend** on every tagged event and tagged charity and uses it to **pre-populate baseline estimates** for the year ahead.
> - An untagged event or charity is still counted in the monthly summaries. It simply gets no line of its own in next year's budget.
>
> **The budget preparation window runs from May 1st to June 30th, and the budget locks automatically as Finalized on July 1st**, the day the new fraternal year begins.
>
> - Changes are accepted from **May 1 at 00:00** until **midnight on June 30** (local time).
> - **Before May 1** the data service refuses every change (*"The … budget opens for drafting on May 1"*).
> - **From July 1** it refuses every change (*"The … budget was locked as Finalized on July 1"*).
> - Only a Super Admin override can change a budget outside the window.

### 12.1 The budget year and its window

Choose the **Fraternal year** (July 1 – June 30). The picker opens on the next year to prepare. The **Budget window** badge shows where that year stands:

| Badge | When | What you can do |
|---|---|---|
| **Not Yet Open** | Before May 1 of the year's first calendar year | Read only |
| **Draft** | May 1 (00:00) – June 30 (midnight) | Run the rollup, add custom lines, edit proposed amounts and notes |
| **Finalized** | From July 1 | Read only |

### 12.2 Initialize Automated Prior Year Baseline Rollup

The navy **Initialize Automated Prior Year Baseline Rollup** button, next to the year picker, reads the previous fraternal year's actual spend for your council only and fills in the **Pre-Populated Baseline** column:

- **Each annual event** of the council: the event's recorded **Spend** plus the approved and reimbursed expense reports linked to it.
- **Each annual charity** the council paid: the total of that year's charity checks.
- **Council Meetings**: the approved and reimbursed expense reports linked to the council's meetings.
- **Last year's custom lines** are carried forward under the same names. Their baseline is **last year's approved amount** for that line, so running costs such as Bank Fees keep their funding level. It is $0.00 if last year's budget was never approved.

New lines start as **Draft** with a **Proposed Budget Amount** of $0.00 for your review. You can run the rollup again at any time from May 1 to June 30: it refreshes the baselines (and renamed events or charities) but **never changes proposed or approved amounts or notes**, and never removes a line.

### 12.3 The budget spreadsheet

Lines are grouped under **your council's own budget categories** (funds), each with a subtotal, and a council total closes the sheet. Lines not yet filed under a category appear last, under **Uncategorized**.

- Each council keeps its categories under **Council Lookup Tables → Budget categories** (§9). Council 15295 starts with its six funds: Father George Wolf Memorial Fund, Sister Rita Rose Vistica Parish Community Fund, Cathedral School & Student Support, Other Donations & Projects, Council Maintenance & State/Supreme Programs, and Blessed Michael McGivney Fraternal Activities Fund.
- Every other council adds its own.
- A rollup files each new line under the same category as the line it continues from last year. File a line once and it stays filed year after year.

Each row shows the **Line Item**, then last year's two figures side by side inside a navy frame, then this year's figures. Last year's figures are its **Approved Cap** (the amount the council voted for that line last year, or — if there was no approved line) and its **Actual Spend** (what the line really cost last year, shown in red when it went over the cap). This year's figures are the **Pre-Populated Baseline**, the **Proposed Budget Amount**, the **Approved Budget Amount** and its **Status** (Draft, Proposed or Approved). Custom lines show $0.00 actual spend, because their spending is not tracked line by line. Every member who can read the budget sees last year's columns. While the budget is in Draft, editors can:
- type the proposed amount and any **Notes** in the row's boxes (the line becomes **Proposed**);
- pick the row's **Category**.

The **Approved Budget Amount** is never typed in: it shows **🔒 Locked** until leadership approves and finalizes the whole budget (§12.6).

Each change saves when you leave the box or make the pick. **Saved** appears beside the row, or the reason it was refused. The scorecards above the sheet show the baseline total, the proposed total, the approved total (once approved) and the change from the baseline.

### 12.4 Custom council operational lines

Use **+ Add Custom Council Operational Line** at the top of the spreadsheet for running costs that are not an event or a charity, such as **Bank Fees** or **Bulletin Ads**. Enter the **Line item name**, a **Proposed budget amount** and optionally its **Budget category**. The line is added as **Proposed**; its approved figure stays locked until the council's vote (§12.6). Each name can be used once per council and year (capitals and spacing are ignored). Custom lines are carried into next year's rollup automatically.

### 12.5 Demonstrations: Simulate June Drafting Window

On the demonstration build (in-memory data), Super Admins see a **Simulate June Drafting Window** checkbox. Ticking it treats the chosen year as Draft so the inputs unlock outside the May 1 – June 30 window. It also sends the Super Admin override with each change, so even a Finalized year can be edited for the demo. It does not appear for other roles or on the production data service. It never reopens an approved budget.

### 12.6 Approve & Finalize Entire Budget

After the council votes on the budget, usually at its July meeting, an Admin, Treasurer, Financial Secretary or Super Admin records the vote with the red **Approve & Finalize Entire Budget** button above the spreadsheet, then confirms with **Yes, approve and finalize**.

- In one step, every line's **Proposed Budget Amount** becomes its **Approved Budget Amount**, and the whole year shows **Approved**.
- The approved year is **frozen for everyone**: no line can be edited, added or rolled up again, and not even a Super Admin override reopens it (*"The … budget was approved and finalized by the council; its figures are frozen"*).
- The button works from the year's May 1 opening onward, including after the July 1 lock. The Designated Budget Director prepares the budget but cannot approve it.
- The approved figures become the caps on the dashboard's budget tracking gauges (§11.5).

### 12.7 Historical Performance Review

Admins, Treasurers, Financial Secretaries and Super Admins see a second tab, **Historical Performance Review**.

- The trailing scorecard sums every **approved**, completed fraternal year: total approved budgets, actual spend, and **fiscal efficiency** (actual spend ÷ approved budget), plus how many years stayed within budget.
- Pick a **Completed fraternal year** (one whose June 30 has passed) to see a read-only sheet of each line's **Final Allocation** beside its **Actual Year-End Spend**, with the variance, the percentage used and a status tag, grouped by category.
- A **Financial performance KPI** card heads the sheet with the year's allocation, actual spend (including unbudgeted spend), variance, fiscal efficiency and lines within budget.
- A year the council never approved is listed but has no allocations to measure against.

![Image: Annual Budget Projections]

---

## 13. Super Admin: system lookups and councils

### 13.1 System lookups

**Path:** sidebar → **Global Governance Matrices** (Super Admins only)

| Table | Holds |
|---|---|
| **Member Status** | Active, Inactive, and similar |
| **Role** | Officer positions (Grand Knight, Treasurer, …), each with an **Officer** flag |
| **Degree** | First through Fourth |
| **Member Type** | Super Admin, Admin, Member |
| **Category** | Event and activity categories |
| **No-Show Reason** | One-letter code plus description |
| **Meeting Type** | Regular Monthly, Officer, and similar |
| **Lessons Learned Category** | Planning, Budgeting, Execution, and similar |

Values marked **Built in** (*"The application depends on this value"*) cannot be renamed or deleted. These are the **Active** member status and the **Super Admin**, **Admin** and **Member** types.

> **Caution:** finance access is granted by the role **names** *Treasurer* and *Financial Secretary*. These roles are not locked, so renaming either one (for example to "Treasurer (2026)") silently removes finance access from the officers who hold it. Keep those two names exactly as they are.

### 13.2 Feedback inbox

Members send feedback and bug reports from **Online Help Center → Submit System Feedback or Bug Report**. Super Admins see the **Feedback inbox** below that form on the same page. It lists each report newest first, with the sender's name, council, phone, email and the time it was submitted (UTC). No one else can read the inbox.

### 13.3 Councils

**Path:** sidebar → **Councils**. Only a Super Admin may add, edit or delete a council. Admins manage their council's parishes, pastors, activities and distribution lists instead.

---

## 14. Data protection rules

- **Nothing cascades.** A record that other records still point to cannot be deleted. You will see a **record in use** message naming what depends on it. For example, a shift with sign-ups, a member with logged hours, or a lookup value in use are all protected, which keeps the council's history of hours, donations and messages intact. Remove or reassign the dependent records first, or leave the record in place.
- The only exception: deleting a distribution list also clears its member list.
- **Time windows** protect records: shift hours can be logged up to 3 months back, and activity hours up to 6 months back.

---

## 15. Administrator troubleshooting reference

| Symptom / message | Cause | Fix |
|---|---|---|
| A section is missing from the sidebar | Your member type or role does not include it (§1). | Ask a Super Admin to check your member type or roles. |
| *"…cannot …"* refusal when saving | You are acting outside your council, or without the required tier. | Switch the **Council** selector, or ask a Super Admin. |
| Shift date refused | It is outside the event's Starts–Ends range. | Adjust the event dates or the shift date. |
| Event date refused | **Ends** is before **Starts**. | Correct the dates. |
| Delete refused (record in use) | Other records depend on it (§14). | Clear the dependants first, or keep the record. |
| Cash or electronic fields locked on the ledger | Donations now drive those totals. | Correct the donations in **Donations** instead. |
| Council lookups save refused | One row failed, so nothing was saved. | Fix the row named in the message and save again. |
| Member cannot find their QR code | No **QR code image URL** is on file. | Add it under **Council Lookup Tables → Enabled donation methods**. |
| *"Your role cannot maintain this council's lookups."* | Finance officer on another council, or no finance role. | A council Admin or Super Admin must make the change. |
| Audits missing from Executive Summaries | Finance officers see the monthly summary only. | Ask an Admin for the audit figures. |
| Budget inputs and buttons greyed out | The chosen year is **Not Yet Open** or **Finalized** (§12.1), or it is **Approved** (§12.6). | Budgets are edited only from May 1 to June 30, before the council approves them. Pick the year you are preparing. |
| *"The … budget was approved and finalized by the council"* | The council's vote was recorded (§12.6). | Approved budgets are frozen for everyone; nothing reopens them. |
| Dashboard says there are no caps to track | The fraternal year's budget has not been approved and finalized. | Record the council's vote with **Approve & Finalize Entire Budget** (§12.6). |
| *"The … budget opens for drafting on May 1"* | The drafting window for that year has not started. | Wait for May 1, or ask a Super Admin. |
| *"The … budget was locked as Finalized on July 1"* | The year has started, so the data service refuses changes. | Only a Super Admin override can change a Finalized budget. |
| Budget shows **Read only** / **Transparency view** | You are not an Admin, Treasurer, Financial Secretary or Designated Budget Director. | Ask a council Admin to tick **Designated Budget Director** on your roster record, then sign in again. |
| Every budget line is **Uncategorized** | The council has no budget categories, or the lines were never filed. | Add categories under **Council Lookup Tables → Budget categories**, then pick each line's **Category**. |
| *"…already has a line named…"* | That custom line exists for this council and year. | Edit the existing line's approved amount instead. |
| An annual event is missing from the budget | It is not tagged **Is Annual**, it is not linked to your council, or it did not start in the prior fraternal year. | Tick **Is Annual** on the event, then run the rollup again. |
| **Mark no-show** missing on a turnout row | The volunteer has hours logged, or the event is not linked to your council. | Correct the hours first, or ask an Admin of the event's council. |
| New member cannot sign in | They have not onboarded, or their roster email is wrong. | Check the **Email (also the login)** field. They must create a password on the phone first. |

Quick answers are also in the portal's **Online Help Center**.

---

## Appendix: Council Archive Vault and parish QR codes

- **Council Archive Vault.** Open **Administrative Lookups** in the sidebar and select **📂 Council Archive Vault**. The council's shared Google Drive folder opens in a new browser tab. The link shows only to seated officers, Admins and Super Admins; regular members do not see it. Google Drive's own sharing settings still decide who can open the folder.
- **App download keys.** The **Welcome, Brother Knight** card on **Member Actions**, which doubles as the hall projector's app download checkpoint, shows two codes from `apps/web/public/assets/images/qr/`.
- **Collection QR codes.** On the phone's **Donate** screen, tapping Venmo, ParishSoft, Zeffy or Zelle opens a full-screen pop-up with only that channel's code. The phone shows the image link your council set under **Council Lookup Tables → Enabled donation methods** first. If there is none, or it cannot be loaded, it shows the code that comes with the app from `apps/mobile/assets/images/qr/`.

To put a real code in place, replace the placeholder file and keep its name:

| Code | File |
|---|---|
| ![Mobile App Expo Go Sync QR code](../apps/web/public/assets/images/qr/expo-go-sync.png) | `apps/web/public/assets/images/qr/expo-go-sync.png` |
| ![Member Sign-Up QR code](../apps/web/public/assets/images/qr/member-sign-up.png) | `apps/web/public/assets/images/qr/member-sign-up.png` |
| ![ParishSoft collection QR code](../apps/mobile/assets/images/qr/parishsoft-collection.png) | `apps/mobile/assets/images/qr/parishsoft-collection.png` |
| ![Venmo collection QR code](../apps/mobile/assets/images/qr/venmo-collection.png) | `apps/mobile/assets/images/qr/venmo-collection.png` |
| ![Zeffy collection QR code](../apps/mobile/assets/images/qr/zeffy-collection.png) | `apps/mobile/assets/images/qr/zeffy-collection.png` |
| ![Zelle collection QR code](../apps/mobile/assets/images/qr/zelle-collection.png) | `apps/mobile/assets/images/qr/zelle-collection.png` |
