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

The sidebar shows only the sections your role can use, folded into four groups: **Self-Service Hub** (always open: Member Actions Hub, Propose Charity Grant, Communications Hub), **Volunteer Operations**, **Financial Ledgers** and **Administrative Lookups**. Select a group's heading to open or close it; the group holding the page you are on opens by itself, and the portal remembers your choices in this browser. A group with nothing for your role is not shown. **My Profile** is in the member menu: select your name and photo at the top right. **Online Help Center** is the **Help** link (question-mark icon) at the top right, just left of the alert bell. Everyone sees Member Actions Hub, Post-event Ledger, My Expense Reports, Communications Hub, My Profile and Online Help Center.

Expense checks are issued only by the council's **Financial Secretary** or **Treasurer**, or a Super Admin; an Admin without one of those roles approves and returns reports in the **Leadership Auditing Queue** but does not see **Bulk Check Disbursements**. Nobody, a Super Admin included, may approve or pay an expense report they submitted.

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
| Annual Budget Projections | | | ✔ own council | ✔ own council | ✔ any council |

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
2. **Invite:** choose **All active members**, **Officers only** or **Choose members…**. Invited members get a message in the app.
3. Select **Schedule meeting**. You will see *"Meeting scheduled and invitations sent."*
4. **Minutes:** open the meeting and select **Upload minutes** (or **Replace minutes**). Members can then read them from their phones.
5. **Invitations and attendance:** tick who attended and save. This feeds each member's meeting-hour totals. If members joined the council after the meeting was scheduled, select **Invite all active members** to invite every active member who is missing.

Officers see **Take attendance** on each meeting on their phone's Home tab.

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

- Edit rows in place. Changed rows are marked **Edited**.
- **Changes are saved together:** select **Save changes**. If any row is refused, **none** are written, so fix the reported row and save again.
- **Enable a QR method** (Venmo, Zelle, Zeffy, ParishSoft) by adding it and pasting the link to the council's QR image. Until a link is saved, members see *"Your council has not uploaded this QR code yet."*
- Activities belong to one council and are **not shared** with sister councils.
- Finance officers see only the two donation tabs, with the note *"As your council's finance officer you maintain its donation types and enabled donation methods."*

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

![Image: Executive Scorecard]

---

## 12. Annual budget projections

**Path:** sidebar → **Financial Ledgers** → **Annual Budget Projections** (the council's Admins, Treasurer and Financial Secretary, and Super Admins). Standard members and officers without a finance role never see the budget.

> **The Annual Forecasting Tag System**
>
> The **Is Annual** checkbox on the **Event** form (Event Planner) and on a **Global Charities Registry** entry is a **financial accounting tag only**.
>
> - It does **not** duplicate calendar cards, copy the event, or create any future schedule entries. Next year's edition of an event is still planned in the Event Planner (for example with **Copy as twin**, which keeps the tag).
> - It tells the Budget Engine which events and charities recur each year. When the budget is prepared, the engine reads the **prior fraternal year's actual audited spend** on every tagged event and tagged charity and uses it to **pre-populate baseline estimates** for the year ahead.
> - An untagged event or charity is still counted in the monthly summaries. It simply gets no line of its own in next year's budget.
>
> **Budgets are prepared in June and locked automatically as Finalized on July 1st**, the day the new fraternal year begins. Outside June the budget can be read but not changed.

### 12.1 The budget year and its window

Choose the **Fraternal year** (July 1 – June 30). The picker opens on the next year to prepare. The **Budget window** badge shows where that year stands:

| Badge | When | What you can do |
|---|---|---|
| **Not Yet Open** | Before June 1 of the year's first calendar year | Read only |
| **Draft** | June 1 – June 30 | Run the rollup, add custom lines, edit approved amounts and notes |
| **Finalized** | From July 1 | Read only |

### 12.2 Initialize Automated Prior Year Baseline Rollup

The navy **Initialize Automated Prior Year Baseline Rollup** button, next to the year picker, reads the previous fraternal year's actual spend for your council only and fills in the **Pre-Populated Baseline** column:

- **Each annual event** of the council: the event's recorded **Spend** plus the approved and reimbursed expense reports linked to it.
- **Each annual charity** the council paid: the total of that year's charity checks.
- **Council Meetings**: the approved and reimbursed expense reports linked to the council's meetings.
- **Last year's custom lines** are carried forward under the same names with a baseline of **$0.00**.

New lines start with an **Approved Budget Amount** of $0.00 for your review. You can run the rollup again at any time in June: it refreshes the baselines (and renamed events or charities) but **never changes approved amounts or notes**, and never removes a line.

### 12.3 The budget spreadsheet

Lines are grouped under the council's six funds, each with a subtotal, and a council total closes the sheet:

| Fund | Lines filed there |
|---|---|
| **Father George Wolf Memorial Fund** | Lines whose name mentions *Wolf* |
| **Sister Rita Rose Vistica Parish Community Fund** | Lines naming *Vistica*, gifts to *Parish* charities, and *Parish Community* events |
| **Cathedral School & Student Support** | Lines naming a school, students or scholarships |
| **Other Donations & Projects** | Every other charity gift |
| **Council Maintenance & State/Supreme Programs** | Council Meetings and custom operational lines |
| **Blessed Michael McGivney Fraternal Activities Fund** | Every other event, and lines naming *McGivney* |

Each row shows the **Line Item**, its **Pre-Populated Baseline** and the **Approved Budget Amount**. While the budget is in Draft, type the approved amount and any **Notes** in the row's boxes; each change saves when you leave the box (**Saved** appears beside the row, or the reason it was refused). The scorecards above the sheet show the baseline total, the approved total and the change between them.

### 12.4 Custom council operational lines

Use **+ Add Custom Council Operational Line** at the top of the spreadsheet for running costs that are not an event or a charity, such as **Bank Fees** or **Bulletin Ads**. Enter the **Line item name** and a **Target budget amount**. Each name can be used once per council and year (capitals and spacing are ignored). Custom lines are carried into next June's rollup automatically.

### 12.5 Demonstrations: Simulate June Drafting Window

On the demonstration build (in-memory data), Super Admins see a **Simulate June Drafting Window** checkbox. Ticking it treats the chosen year as Draft so the inputs unlock outside June. It does not appear for other roles or on the production data service.

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
| Budget inputs and buttons greyed out | The chosen year is **Not Yet Open** or **Finalized** (§12.1). | Budgets are edited only in June. Pick the year you are preparing. |
| *"…already has a line named…"* | That custom line exists for this council and year. | Edit the existing line's approved amount instead. |
| An annual event is missing from the budget | It is not tagged **Is Annual**, it is not linked to your council, or it did not start in the prior fraternal year. | Tick **Is Annual** on the event, then run the rollup again. |
| **Mark no-show** missing on a turnout row | The volunteer has hours logged, or the event is not linked to your council. | Correct the hours first, or ask an Admin of the event's council. |
| New member cannot sign in | They have not onboarded, or their roster email is wrong. | Check the **Email (also the login)** field. They must create a password on the phone first. |

Quick answers are also in the portal's **Online Help Center**.
