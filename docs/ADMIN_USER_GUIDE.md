# Knights of Columbus Tracking Platform — Administrator User Guide

**Audience:** Council Admins, Super Admins, the Grand Knight (GK), the Deputy Grand Knight (DGK), the Financial Secretary (FS), the Treasurer, Trustees and other council officers.

**Covers:** the management pages of the web portal, grouped by the seven sidebar pillars.

> **Every administrator is also a member.** Signing up, logging hours and taking donations are in the [Member User Guide](MEMBER_USER_GUIDE.md).
> The full access table is in the [Role Permissions Matrix](ROLE_PERMISSIONS_MATRIX.md).

---

## Contents

1. [Roles and access](#1-roles-and-access)
2. [The seven pillars](#2-the-seven-pillars)
3. [Module feature flags](#3-module-feature-flags)
4. [Governance](#4-governance)
5. [Faith In Action](#5-faith-in-action)
6. [Finances](#6-finances)
7. [Performance](#7-performance)
8. [Resources and the Google Drive archive vault](#8-resources-and-the-google-drive-archive-vault)
9. [Answers](#9-answers)
10. [Setup and the Supreme roster sync](#10-setup-and-the-supreme-roster-sync)
11. [Data protection rules](#11-data-protection-rules)
12. [Troubleshooting reference](#12-troubleshooting-reference)
13. [Automated messages reference](#13-automated-messages-reference)
14. [Member engagement and the roster lifecycle](#14-member-engagement-and-the-roster-lifecycle)
15. [Volunteer time quarantine](#15-volunteer-time-quarantine)
16. [Appendix: QR code files](#appendix-qr-code-files)

### How to read a tutorial

Every tutorial starts with a **Prerequisite (who can do this)** line. The line states the access privilege that the task needs. Stop when your role is not on the line.

Every tutorial then has five parts: **Goal**, **Start point**, **Steps**, **Expected result** and **Common problems**.
A **Warning** line comes before the steps when the task deletes data, sends messages, posts money or cannot be undone.

---

## 1. Roles and access

### 1.1 Member types and officer roles

A member has one member type. A member may also hold one or more officer roles.

| Member type | Scope |
| --- | --- |
| **Member** | The member's own records and the shared member pages. |
| **Admin** | The Admin's own council only. |
| **Super Admin** | Every council. |

| Officer role | Extra access |
| --- | --- |
| **Grand Knight** and **Deputy Grand Knight** | The executive dashboard and the charity vetting desk. The GK also counter-signs expenses and keeps the cadence and agenda templates. |
| **Financial Secretary** | Issues written orders on expenses. Posts to the general ledger. Pays checks. |
| **Treasurer** | Posts to the general ledger. Pays checks. |
| **Trustee** | Vets charity requests. Follows up on grants after 6 months. |
| **Recorder** | Edits the live agenda. Records hand tallies. |
| Any other seated officer | Reads the dashboards. Schedules meetings. Runs the live console. |

### 1.2 Access rules

- An Admin acts only on the Admin's own council. A Super Admin acts on any council.
- The data service checks every rule. A refused action shows a message and changes nothing.
- Nobody signs or pays an expense report that the same person submitted. The rule includes Super Admins.
- One person never signs both lines of the same expense report.

> **Caution:** finance access follows the role names **Treasurer** and **Financial Secretary**.
> A renamed role removes finance access from the officers who hold the role. Keep both names exactly as written.

<!-- KEEP_IMAGE: member actions hub with the role-filtered sidebar -->
![Member Actions Hub with the role-filtered sidebar (/member-actions)](../generated/dashboard_visual_catalog/member-actions.png)
<!-- /KEEP_IMAGE -->

### 1.3 Choose the council

Most management pages have a **Council** selector at the top.

- An Admin sees the Admin's own council.
- A Super Admin may choose any council.

The navy header shows your own council, your name, your member type and your officer status.

---

## 2. The seven pillars

### 2.1 Concept: pillar navigation

The sidebar has seven pillars. Every pillar is always open. A pillar shows only the links that your role may open.
A pillar with no allowed links does not show.

A link that your role cannot open does not show. The sidebar never shows a locked or greyed-out link.
The rule includes the five officer desks: **Live Meeting Console**, **Annual Cadence Manager**, **FS Expense Audit**, **GK Expense Authorize** and **Charity Vetting Queue**.

| Pillar | Links, in sidebar order | Main audience |
| --- | --- | --- |
| **Governance** | Live Meeting Console, Annual Cadence Manager, Meeting Center, Council Officer Nominations, Appointed Leadership Matrix, Constitutional Bylaws, Constitutional Advisor | Officers, the GK, Admins. The Constitutional Advisor shows to officers, Admins and Super Admins only. |
| **Faith In Action** | Standalone Activities, Member Actions Hub, Event Planner, Visual Master Calendar | Admins plan. Members volunteer. |
| **Finances** | General Ledger Spreadsheet, Balance Sheet, Financial Dashboard, My Expense Reports, Leadership Auditing Queue, Bulk Check Disbursements, FS Expense Audit, GK Expense Authorize, Charity Vetting Queue, Propose Charity Grant, Charitable Disbursements Ledger, Donations History, Annual Budget Projections | Finance officers, the GK, Admins |
| **Performance** | Executive Dashboard, Growth & Hours Charts, Post-event Ledger, Lessons Registry | Seated officers, Admins |
| **Resources** | Fraternal Photo Gallery, Council Artifacts, Marketing Factory, 📂 Council Archive Vault | Every member. The Marketing Factory and the vault link show to officers and Admins only. |
| **Answers** | Online Help Center, SOP Center | Every member |
| **Setup** | Councils, Affiliated Roster, Supreme Council Sync, Council Lookup Tables, Credentials Vault, Global Charities Registry, Global Governance Matrices, Parish & Pastors Linkage | Admins, finance officers, Super Admins. The Credentials Vault shows to officers, Admins and Super Admins only. |

Three pages open from the header, not from the sidebar.

- **Messaging** (envelope icon) → **Council Messages & Alerts** and **My Distribution Lists**.
- **Help** (question-mark icon) → **Online Help Center**.
- Your name → **My Profile**.

---

## 3. Module feature flags

### 3.1 Concept: backend logic of the flags

Each council row has twelve on/off columns. Each column is a module feature flag. A new council has every flag on.

| Flag column | Label in the Feature Flags Control Center | Web pages hidden when off | Phone items hidden when off |
| --- | --- | --- | --- |
| `flag_mobile_elections` | **Officer elections** | Council Officer Nominations, Appointed Leadership Matrix | None |
| `flag_fundraising_inflow` | **Fundraising inflow** | Donations History | **Donate** |
| `flag_charity_proposals` | **Charity proposals** | Propose Charity Grant, Charity Vetting Queue | None |
| `flag_complex_shifts` | **Event shifts** | Event Planner, the shift tabs of Member Actions Hub | **Signup**, and the shift mode of **Report** |
| `flag_meeting_management` | **Meeting management** | Meeting Center, Annual Cadence Manager, Live Meeting Console | **Mtgs** |
| `feature_expense_reporting` | **Expense reporting** | My Expense Reports, Leadership Auditing Queue, FS Expense Audit, Treasurer Ledger Audit Desk, GK Expense Authorize, Bulk Check Disbursements | The expense screen and the **Expense reports** card on **Home** |
| `feature_faith_center` | **Faith Center** | Faith Center | The feast-day banner, the Daily Bible Quote, the praying hands and the prayer intentions |
| `feature_constitutional_advisor` | **Constitutional Advisor** | Constitutional Advisor | None |
| `feature_council_bylaws` | **Council bylaws** | Constitutional Bylaws | None |
| `feature_council_history` | **Council history** | Council history (Team Legacy) | None |
| `feature_live_meeting_console` | **Live meeting console** | Live Meeting Console | None |
| `feature_volunteer_quarantine` | **Volunteer time quarantine** | The **Volunteer Time Quarantine Desk** on the Executive Dashboard. Members' hours also stop going to review (section 15). | None |

The flags follow four rules.

1. A flag that is off hides the module from every member of the council. The rule includes Admins.
2. A hidden desk is gone from the sidebar.
3. A hidden page refuses a typed web address. The phone sends a member on a hidden screen back to **Home**.
4. A flag never deletes data. A flag that is switched back on restores the module with all records.

The general ledger, the budget and the activity hour log have no flag. They stay on for every council.

### 3.2 Switch a module on or off

> **Prerequisite (who can do this):** You must have Super Admin privileges. Council Admins do not see the Feature Flags Control Center.
> **Warning:** a switched-off module disappears at once for every member of the council, on the web and on the phone.

**Goal:** Turn one optional module on or off for one council.

**Start point:** Sidebar → Setup → **Feature Flags Control Center**.

**Steps:**
1. Find the row of the module. Each row shows the label, the flag column and the pages the flag hides.
2. Find the column of the council. Each column shows the council number and how many modules are on.
3. Clear the box to hide the module. Select the box to show the module.

**Expected result:** The platform saves each switch at once. Members of the council see the change the next time each page loads.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A member still sees a phone tab. | The phone read the flags before the change. | Ask the member to sign out and sign in again. |
| *"… is not a feature flag"* | The request named an unknown flag. | Use one of the twelve flags in 3.1. |

---

## 4. Governance

### 4.1 Run a live meeting

> **Prerequisite (who can do this):** You must be a seated officer of the council, a council Admin, the meeting owner or a Super Admin. Other members do not see this desk.
> **Warning:** **Passed**, **Failed** and **Tabled** record the council's decision on the motion.

**Goal:** Chair a council meeting from one screen.

**Start point:** Sidebar → Governance → **Live Meeting Console**.

**Steps:**
1. Choose the meeting in **Meeting**.
2. Select **Start live console**.
3. Check in members in **Live attendance**. Use **Find a member** to search.
4. Select a line in **Order of Business** to put the line on the floor.
5. Set **Allotted minutes** for the topic.
6. For a motion, select **Launch secret smartphone ballot**. Members vote **Approve**, **Deny** or **Abstain** on their phones.
7. Select **Passed**, **Failed** or **Tabled**.
8. Select **Close the console** after the last item.

<!-- KEEP_IMAGE: live meeting console capture -->
![Live Meeting Console (/meetings/live)](../generated/dashboard_visual_catalog/meetings_live.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The top bar shows **Now on the floor** and the countdown. Phones that follow the agenda show the same line.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| *"Start the console first"* | The console is not live. | Select **Start live console**. |
| *"Decide the open ballot first"* | A ballot is still open. | Decide the open motion. Then continue. |
| **Passed** is greyed out. | The smartphone ballot has no more Approve votes than Deny votes. | Select **Failed** or **Tabled**. |
| *"No meeting from the past week on is yours to run."* | No meeting is in range for you. | Schedule the meeting in the **Meeting Center**. |

### 4.2 Record a hand tally

> **Prerequisite (who can do this):** You must be the council's Grand Knight or Recorder, a council Admin or a Super Admin.
> **Warning:** **Save tally & decide the motion** decides the motion. A tie fails the motion.

**Goal:** Record a vote by raised hands.

**Start point:** Sidebar → Governance → **Live Meeting Console** → the motion → **Record Hand Tally**.

**Steps:**
1. Count the hands for the motion. Enter the count in **Approved hands**.
2. Count the hands against the motion. Enter the count in **Denied hands**.
3. Select **Save tally & decide the motion**.
4. Optional: for a passed motion that releases money, choose the posting in **General-ledger posting**. Select **Save link**.

**Expected result:** The motion shows **Passed** or **Failed**. A linked motion shows **Ledger linked**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| *"Type both counts; at least one hand."* | A count is empty, or both counts are 0. | Enter both counts. |
| The hand tally is refused. | A smartphone ballot already opened on the motion. | Decide the motion from the ballot result. |

### 4.3 Correct a live agenda line

> **Prerequisite (who can do this):** You must be the council's Grand Knight or Recorder, a council Admin or a Super Admin.

**Goal:** Fix or add an agenda line during the meeting.

**Start point:** Sidebar → Governance → **Live Meeting Console** → **Order of Business**.

**Steps:**
1. Select the line. The line opens for editing.
2. Correct the text. Press Enter to save. Press Escape to cancel.
3. For a new topic, select **Blank last-minute line - click to write it**.

**Expected result:** The corrected line shows on the console and on members' phones.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A line does not open for editing. | The DGK and other officers do not edit the agenda. | Ask the GK or the Recorder. |

### 4.4 Lay down the year's meetings with a cadence

> **Prerequisite (who can do this):** You must be a council Admin, the Grand Knight or a Super Admin. Other members do not see this desk.
> **Warning:** **Populate the year** creates up to 12 meetings and their invitations.

**Goal:** Create the fraternal year's regular meetings in one step.

**Start point:** Sidebar → Governance → **Annual Cadence Manager**.

**Steps:**
1. Select **Add cadence**.
2. Choose the **Meeting type**.
3. Set **Recurrence pattern: week** and **Recurrence pattern: day**, for example First and Tuesday.
4. Set **Start time**, **Default location** and **Default recipient group**.
5. Select **Save cadence**.
6. Choose the **Fraternal year**. Select **Populate the year**.

<!-- KEEP_IMAGE: annual cadence manager capture -->
![Annual Cadence Manager (/meetings/cadence)](../generated/dashboard_visual_catalog/meetings_cadence.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The platform creates one meeting per month, July through June. Each meeting lasts 120 minutes.
Invitations are released 5 days before each meeting.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A month has no new meeting. | A meeting of the same type already exists on that date. | No action. The platform skips the date. |

### 4.5 Schedule a single meeting

> **Prerequisite (who can do this):** You must be a seated officer of the council, a council Admin or a Super Admin.
> **Warning:** **Schedule meeting** sends invitations at once.

**Goal:** Create one meeting and invite members.

**Start point:** Sidebar → Governance → **Meeting Center**.

**Steps:**
1. Select **New meeting**.
2. Fill in **Meeting name**, **Type**, **Date**, **Location**, **Starts** and **Ends**.
3. Check the **Agenda**. The **Type** fills the agenda from the council's template.
4. For a meeting over several days, tick **Multi-Day Assembly / Extended Event**. Set the **End date**.
5. Choose the invitees: **All active members**, **Officers only** or **Choose members…**.
6. Select **Schedule meeting**.
7. After the meeting, select **Upload minutes**. Tick each attendee. Save.

<!-- KEEP_IMAGE: meeting center capture -->
![Meeting Center (/meetings)](../generated/dashboard_visual_catalog/meetings.png)
<!-- /KEEP_IMAGE -->

**Expected result:** A message shows *"Meeting scheduled and invitations sent."*

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| New members are not invited. | The members joined after the meeting was scheduled. | Select **Invite all active members**. |
| A multi-day assembly adds no hours. | Multi-day assemblies add no meeting hours by design. | No action. |

### 4.6 Keep the meeting agenda templates

> **Prerequisite (who can do this):** You must be a council Admin, the Grand Knight or a Super Admin.

**Goal:** Set the default agenda for one meeting type.

**Start point:** Sidebar → Setup → **Council Lookup Tables** → **Meeting Agenda Templates**.

**Steps:**
1. Choose the **Meeting type**.
2. Write the outline in **Default agenda outline**.
3. Select **Save template**.
4. To remove a template, clear the text. Select **Save template**.

**Expected result:** A new meeting of the type starts with the outline.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A meeting kept the old agenda. | The officer typed an agenda before choosing the type. | Select **Use the template** on the meeting form. |

### 4.7 Manage nominations and appointments

> **Prerequisite (who can do this):** You must be an active member to nominate. You must be the Grand Knight, a council Admin or a Super Admin to appoint officers.

**Goal:** Fill the council's elected and appointed seats.

**Start point:** Sidebar → Governance → **Council Officer Nominations** or **Appointed Leadership Matrix**.

**Steps:**
1. Open **Council Officer Nominations** to nominate a Brother Knight for office.
2. Open **Appointed Leadership Matrix** to fill an appointed seat.
3. Choose the member for each vacant seat. Save.

<!-- KEEP_IMAGE: nominations and elections capture -->
![Nominations and elections (/elections)](../generated/dashboard_visual_catalog/elections.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: appointed positions capture -->
![Appointed positions (/elections/appointments)](../generated/dashboard_visual_catalog/elections_appointments.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The seat shows the member's name.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| Both pages are missing. | The council switched off **Officer elections**. | Ask a Super Admin (section 3). |

### 4.8 Concept: the Council Bylaws Data Vault

The vault holds one bylaws document per council. Every member of the council reads the bylaws.

- The vault stores the bylaws as text in the `Council.BylawsMarkdown` column. The limit is 100,000 characters.
- The vault also stores the save time in `BylawsUpdatedAt`.
- A line that starts with `# ` starts an article. A line that starts with `## ` starts a section.
- The vault splits the text into clauses. The clause id `A2.S3` means article 2, section 3. The id `A0` holds text before the first article.
- The **Parliamentary engine feed** panel lists every clause with its id, heading and word count.
- The parliamentary engines read the same clauses. A motion or a ruling cites a clause by the clause id.

### 4.9 Edit the council bylaws

> **Prerequisite (who can do this):** You must be the council's Grand Knight, a council Admin or a Super Admin. Other members see no **Edit bylaws** button.
> **Warning:** **Save bylaws** replaces the stored text for every member. The vault keeps no earlier version.

**Goal:** Change the council bylaws.

**Start point:** Sidebar → Governance → **Constitutional Bylaws**.

**Steps:**
1. Copy the current text to a file as a backup.
2. Select **Edit bylaws**. An empty vault starts from an outline.
3. Change the text in **Bylaws text**.
4. Check the **Preview** panel.
5. Check the clause ids in **Parliamentary engine feed**.
6. Select **Save bylaws**.

**Expected result:** A message shows *"The bylaws are saved."*

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A section has no clause id. | The heading has no `## ` at the start. | Add `## ` and a space at the start of the line. |
| The text stops at the limit. | The text has 100,000 characters. | Shorten the text. |

The SOP Center holds the same procedure: **Answers → SOP Center → Edit the council bylaws**.

---

## 5. Faith In Action

### 5.1 Create an event

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.

**Goal:** Create an event that volunteers can sign up for.

**Start point:** Sidebar → Faith In Action → **Event Planner**.

**Steps:**
1. Select **New event**.
2. Fill in **Event name**, **Description**, **Starts**, **Ends** and **Location**.
3. Choose the **Category** and the **Owner**.
4. Optional: enter **Budget ($)** and **Planned attendees**.
5. Tick each council in **Councils sharing this event**.
6. Tick **Is Annual** for an event that repeats each year (see 6.12).
7. Save.

<!-- KEEP_IMAGE: event planner capture -->
![Event Planner split screen (/events)](../generated/dashboard_visual_catalog/events.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: council calendar capture -->
![Council calendar (/calendar)](../generated/dashboard_visual_catalog/calendar.png)
<!-- /KEEP_IMAGE -->

**Expected result:** A message shows *"Event created. Add its shifts below."*

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The date is refused. | **Ends** is before **Starts**. | Correct the dates. |
| The save is refused. | No council is ticked. | Tick at least one council. |

### 5.2 Add shifts to an event

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.
> **Warning:** a shift with sign-ups or logged hours cannot be deleted.

**Goal:** Give the event the time slots that volunteers fill.

**Start point:** Sidebar → Faith In Action → **Event Planner** → the event → **Shifts** panel.

**Steps:**
1. Enter the **Shift name**.
2. Enter a **Date** inside the event dates.
3. Enter the start time and the end time.
4. Enter **Volunteers needed**.
5. Select **Add shift**.
6. Repeat steps 1 to 5 for each day and time slot.

<!-- KEEP_IMAGE: shift grid placeholder -->
![Image: Shift Grid]
<!-- /KEEP_IMAGE -->

**Expected result:** The shift shows in the grid with a status pill.

| Pill | Meaning |
| --- | --- |
| **Full** (navy) | The shift has its volunteers. Extra members may join as honorary volunteers. |
| **Needs *n* soon** (red) | The shift starts within 48 hours and needs volunteers. |
| **Needs *n*** (gold) | Nobody has signed up, or the shift starts within 7 days. |
| **Needs *n*** (outline) | The shift has time to fill. |

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The shift date is refused. | The date is outside the event dates. | Change the shift date or the event dates. |
| **Delete** is refused. | Members signed up or logged hours. | Keep the shift. |

### 5.3 Copy an event as a twin

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.

**Goal:** Repeat a past event with the same shift pattern.

**Start point:** Sidebar → Faith In Action → **Event Planner** → the past event → **Copy as a twin**.

**Steps:**
1. Check **New event name**. Change the name if needed.
2. Set **New first day**.
3. Select **Copy event**.
4. Check every shift of the twin.

<!-- KEEP_IMAGE: copy as twin placeholder -->
![Image: Copy As Twin]
<!-- /KEEP_IMAGE -->

**Expected result:** A message shows *"Copied. The twin is open on the right."*

| Copied | Not copied |
| --- | --- |
| Details, councils, owner, budget, the **Is Annual** tag | Sign-ups and logged hours |
| Every shift, moved by the same number of days | Post-event results and lessons |

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A shift is on the wrong weekday. | The new first day is on a different weekday. | Pick a first day on the same weekday. |

### 5.4 Keep the council activities

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.

**Goal:** Keep the list of ongoing activities that members log time against.

**Start point:** Sidebar → Faith In Action → **Standalone Activities**.

**Steps:**
1. Add an activity with a name, a description and a category.
2. Save.

<!-- KEEP_IMAGE: activities catalog capture -->
![Activities catalog (/activities)](../generated/dashboard_visual_catalog/activities.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The activity shows as a tile on the phone **Report** tab.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A sister council does not see the activity. | Activities belong to one council. | Add the activity in each council. |

---

## 6. Finances

### 6.1 Concept: the two-signature expense path

| Step | Who acts | Where | Status tag |
| --- | --- | --- | --- |
| 1. File | The member | **My Expense Reports** | **Submitted** |
| 2. Written order | The Financial Secretary | **FS Expense Audit** → **📜 Approve Expense** | **Order Issued** |
| 3. Counter-sign | The Grand Knight | **GK Expense Authorize** → **✍️ Countersign Expense** | **Approved** |
| 4. Pay | The FS or the Treasurer | **Bulk Check Disbursements** | **Reimbursed** |
| Return | Council leadership | **Leadership Auditing Queue** → **Reject & Return** | **Returned** |

- A Super Admin may sign either line, but never both lines of the same report.
- Each signer chooses the budget line in **Assign Ledger Budget Line Item**. The report saves the line.
- The budget counts the report only against the saved line.
- The officer who issued the order sees a **🔒 Collusion Guard** tag. That officer sees no counter-sign button.
- Council Admins open both desks to follow the work. Only the seat holders or a Super Admin sign.
- A signer sees no button on a report the signer cannot sign. A tag tells who signs the report.
- A return clears both signatures and the saved budget line.

<!-- KEEP_IMAGE: my expense reports capture -->
![My Expense Reports (/expenses)](../generated/dashboard_visual_catalog/expenses.png)
<!-- /KEEP_IMAGE -->

### 6.2 Issue a written order

> **Prerequisite (who can do this):** You must be the council's Financial Secretary or a Super Admin. Council Admins read the desk only.
> **Warning:** the order is a signature. The report moves to the Grand Knight.

**Goal:** Approve a report's receipts as the first signature.

**Start point:** Sidebar → Finances → **FS Expense Audit**.

**Steps:**
1. Open the submitted report.
2. Check each receipt against its line.
3. Check the line in **Assign Ledger Budget Line Item**. A meeting report starts on the fraternal activities meetings line, for example **Monthly Council Meetings**.
4. Select **📜 Approve Expense**.

<!-- KEEP_IMAGE: FS audit desk capture -->
![FS Audit Desk (/expenses/audit)](../generated/dashboard_visual_catalog/expenses_audit.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The report leaves the desk. The member sees **Order Issued**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| No **📜 Approve Expense** button shows. | You submitted the report, or you do not hold the seat. | Another signer must act. |
| **📜 Approve Expense** is not available. | No budget line is chosen. | Choose a line in **Assign Ledger Budget Line Item**. |

### 6.3 Counter-sign a voucher

> **Prerequisite (who can do this):** You must be the council's Grand Knight or a Super Admin. Council Admins read the desk only.
> **Warning:** the counter-signature approves the report for payment.

**Goal:** Give the second signature.

**Start point:** Sidebar → Finances → **GK Expense Authorize**.

**Steps:**
1. Open the ordered report.
2. Check the order and the receipts.
3. Check the line in **Assign Ledger Budget Line Item**. The line starts on the Financial Secretary's choice.
4. Select **✍️ Countersign Expense**.

<!-- KEEP_IMAGE: GK authorization desk capture -->
![GK Authorization Desk (/expenses/authorize)](../generated/dashboard_visual_catalog/expenses_authorize.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The member sees **Approved**. The report shows in **Bulk Check Disbursements**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| **🔒 Collusion Guard** shows. | You issued the written order. | Another signer must counter-sign. |

### 6.4 Return a report to the member

> **Prerequisite (who can do this):** You must be a council Admin, the Financial Secretary, the Treasurer or a Super Admin.
> **Warning:** a return clears both signatures.

**Goal:** Send a report back for correction.

**Start point:** Sidebar → Finances → **Leadership Auditing Queue**.

**Steps:**
1. Find the report.
2. Select **Reject & Return**.
3. Write the reason. The member reads the reason.
4. Confirm.

<!-- KEEP_IMAGE: leadership auditing queue capture -->
![Leadership Auditing Queue (/expenses/queue)](../generated/dashboard_visual_catalog/expenses_queue.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The member sees a red **Returned** tag with the reason.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The reason is too vague. | The member cannot fix the report. | Name the receipt and the change. |

### 6.5 Pay approved reports by check

> **Prerequisite (who can do this):** You must be the council's Financial Secretary or Treasurer, or a Super Admin. An Admin without a finance role does not see the page.
> **Warning:** a recorded check is permanent money out of the council's books.

**Goal:** Record the checks for dual-signed reports.

**Start point:** Sidebar → Finances → **Bulk Check Disbursements**.

**Steps:**
1. Tick the reports to pay. The page lists only reports with both signatures.
2. Enter the check number and the payout date for each report.
3. Save.

<!-- KEEP_IMAGE: bulk check disbursements capture -->
![Bulk Check Disbursements (/expenses/disbursements)](../generated/dashboard_visual_catalog/expenses_disbursements.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The member sees **Reimbursed** with the check number.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A report is missing. | The report lacks a signature. | Follow the report in the **Leadership Auditing Queue**. |

### 6.6 Concept: the general ledger

The general ledger is a double-entry ledger. Every transaction has debit lines and credit lines that balance.
A shared transaction id groups the lines.

| Page | Shows |
| --- | --- |
| **General Ledger Spreadsheet** | The chart of accounts with every posting |
| **Balance Sheet** | Assets against liabilities and equity |
| **Financial Dashboard** | Cash flow liquidity, the balance sheet summary, **Quick actions** and the **Electronic bank statement audit** |

Seated officers and Admins read the three pages. Only the FS, the Treasurer and Super Admins post, transfer or upload bank statements.

<!-- KEEP_IMAGE: financial dashboard capture -->
![Financial Dashboard (/finance/dashboard)](../generated/dashboard_visual_catalog/finance_dashboard.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: general ledger spreadsheet capture -->
![General Ledger Spreadsheet (/finance/ledger)](../generated/dashboard_visual_catalog/finance_ledger.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: balance sheet capture -->
![Balance Sheet (/finance/balance-sheet)](../generated/dashboard_visual_catalog/finance_balance-sheet.png)
<!-- /KEEP_IMAGE -->

### 6.7 Post to the ledger or reconcile a bank statement

> **Prerequisite (who can do this):** You must be the council's Financial Secretary or Treasurer, or a Super Admin.
> **Warning:** a posting changes the council's books for every reader.

**Goal:** Record a transaction, move funds or match a bank statement.

**Start point:** Sidebar → Finances → **Financial Dashboard** → **Quick actions**.

**Steps:**
1. To post: choose the debit account and the credit account. Enter the amount and the description. Save.
2. To transfer: choose two asset accounts. Enter the amount. Save.
3. To reconcile: open **Electronic bank statement audit**. Upload the bank CSV file.
4. Read the matched rows and the unmatched rows.

**Expected result:** The dashboard shows **✓ Ledger Balanced (Zero Leaks)** when debits equal credits.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The transfer is refused. | The amount exceeds the source account balance. | Lower the amount. |
| The CSV file is refused. | The file has no Date column, or no Amount or Withdrawal/Deposit columns. | Export the statement again with a header row. |
| A bank row stays unmatched. | No posting has the same check number, or the same amount within 5 days. | Post the missing transaction. Upload again. |

### 6.8 Vet a charity request

> **Prerequisite (who can do this):** You must be a seated officer, a Trustee or an Admin of the council, or a Super Admin. The Knight Shepherd never vets the Shepherd's own request.
> **Warning:** a decline stops the request.

**Goal:** Review a member's charity request and move the request forward.

**Start point:** Sidebar → Finances → **Charity Vetting Queue**.

**Steps:**
1. Claim the request.
2. Check the organization, the 501(c)(3) status and the amount.
3. Advance the request, or decline the request.
4. For an advanced request, select **Place on next agenda**.

<!-- KEEP_IMAGE: propose charity grant capture -->
![Propose Charity Grant (/charities/propose)](../generated/dashboard_visual_catalog/charities_propose.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: charity vetting queue capture -->
![Charity Vetting Queue (/charities/vetting)](../generated/dashboard_visual_catalog/charities_vetting.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The request goes on a Monthly meeting at least 10 days away. The council votes in the **Live Meeting Console**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| **Place on next agenda** is refused. | No Monthly meeting is at least 10 days away. | Schedule the meeting. |
| The desk is missing. | The council switched off **Charity proposals**. | Ask a Super Admin. |

### 6.9 Pay an approved charity grant

> **Prerequisite (who can do this):** You must be the council's Financial Secretary or Treasurer, or a Super Admin.
> **Warning:** the check is permanent money out of the council's books.

**Goal:** Pay a grant that the council approved.

**Start point:** Sidebar → Finances → **Charitable Disbursements Ledger**.

**Steps:**
1. Find the approved request.
2. Enter the check number and the date.
3. Save.

<!-- KEEP_IMAGE: charity funding queue capture -->
![Charity funding queue (/charities/queue)](../generated/dashboard_visual_catalog/charities_queue.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The Shepherd's **My requests** shows the request as paid.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The request is missing. | The council has not passed the motion. | Check the motion in the meeting. |

### 6.10 Record or correct a donation

> **Prerequisite (who can do this):** You must be a council Admin, the Treasurer, the Financial Secretary or a Super Admin. The recorder and the event owner may also correct a donation.

**Goal:** Keep the council's donation records complete.

**Start point:** Sidebar → Finances → **Donations History**.

**Steps:**
1. Choose the **Method**, the **Type** and the **Amount**. For items, enter **Estimated value ($)**.
2. Choose the **Date** and the **Event**, or *Standalone (no event)*.
3. Optional: add the **Donor**, a **Description** and a **Photo link**. Items need a description.
4. Save.

<!-- KEEP_IMAGE: recorded donations history capture -->
![Donations History (/donations)](../generated/dashboard_visual_catalog/donations.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The donation shows under **Event donations** or **Standalone donations**. An event card with cash or electronic donations shows **✓ Automatically Logged to Treasury Ledger**.

To see the donations of one event, select its card. The card gets a thick gold border. The page scrolls down to the list of donations for that event.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The date is refused. | An event donation is dated before the event start. | Use a date on or after the event start. |
| The council or the recorder cannot change. | The platform fixes both fields. | Delete the donation. Record the donation again. |

### 6.11 Concept: the annual budget

The budget covers one fraternal year, July 1 to June 30.

| Badge | When | What editors can do |
| --- | --- | --- |
| **Not Yet Open** | Before May 1 | Read only |
| **Draft** | May 1 (00:00) to June 30 (midnight) | Run the rollup, add lines, edit proposed amounts |
| **Finalized** | From July 1 | Read only |
| **Approved** | After the council vote | Frozen for everyone |

- Every member reads the budget. Non-editors see a **Transparency view** marked **Read only**.
- Editors are the council Admins, the Treasurer, the FS, the **Designated Budget Director** and Super Admins.
- Only a Super Admin override changes a budget outside the window. No override reopens an approved budget.

<!-- KEEP_IMAGE: annual budget projections capture -->
![Annual Budget Projections (/budget)](../generated/dashboard_visual_catalog/budget.png)
<!-- /KEEP_IMAGE -->

### 6.12 Prepare the budget with the rollup

> **Prerequisite (who can do this):** You must be a council Admin, the Treasurer, the Financial Secretary, the Designated Budget Director or a Super Admin. The year must be in **Draft**.

**Goal:** Fill the next year's budget from last year's actual spend.

**Start point:** Sidebar → Finances → **Annual Budget Projections**.

**Steps:**
1. Choose the **Fraternal year**.
2. Select **Initialize Automated Prior Year Baseline Rollup**.
3. Type the proposed amount and **Notes** on each line. Each change saves when you leave the box.
4. Pick the **Category** of each line.
5. For a running cost, select **+ Add Custom Council Operational Line**. Enter the **Line item name** and the **Proposed budget amount**.

**Expected result:** Each line shows a **Pre-Populated Baseline**. The rollup reads three sources.

| Source | Baseline |
| --- | --- |
| Each event tagged **Is Annual** | Last year's approved expenses linked to the event |
| Each charity tagged **Is Annual** | Last year's charity checks |
| Last year's custom lines | Last year's approved amount |

A new rollup refreshes the baselines only. The rollup never changes proposed amounts, approved amounts or notes.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| *"The … budget opens for drafting on May 1"* | The window has not opened. | Wait for May 1. |
| An annual event is missing. | The event has no **Is Annual** tag, or the event started outside last year. | Tick **Is Annual**. Run the rollup again. |
| *"…already has a line named…"* | The custom line exists. | Edit the existing line. |

### 6.13 Approve and finalize the budget

> **Prerequisite (who can do this):** You must be a council Admin, the Treasurer, the Financial Secretary or a Super Admin. The Designated Budget Director cannot approve.
> **Warning:** approval freezes the whole year for everyone. Nothing reopens an approved budget.

**Goal:** Record the council's vote on the budget.

**Start point:** Sidebar → Finances → **Annual Budget Projections**.

**Steps:**
1. Check every proposed amount.
2. Select **Approve & Finalize Entire Budget**.
3. Select **Yes, approve and finalize**. You cannot undo this step.

**Expected result:** Each proposed amount becomes the approved amount. The year shows **Approved**. The dashboard gauges use the approved amounts as caps.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The button is greyed out. | The year has no lines, or the year opens after May 1. | Run the rollup first. |

### 6.14 Concept: receipts, split tickets and Honor Vouchers

A report holds one or more receipts. Each receipt has a merchant, a gross total and a receipt file. Each line item names the receipt it comes from.

| Item | What it means | What the signers see |
| --- | --- | --- |
| Receipt | One ticket from one merchant, with its full total and its file. | A **Receipts** table with **R1**, **R2** and so on. |
| Split ticket | One receipt with council items and personal items. The member lists all items and ticks **Personal** on the member's own items. | Personal lines are struck through. The total reads **Council reimburses**. |
| Honor Voucher | The member has no receipt. The member ticks **⚠️ I have no receipt (Honor Voucher)** and writes the reason. | **⚠️ HONOR VOUCHER - NO RECEIPT ATTACHED** with the member's reason. |

- The council pays only the lines without **Personal**. Checks, budgets, asset costs and the balance sheet leave personal lines out.
- On a submitted report, the lines of each receipt must add up to the receipt's gross total.
- On a submitted report, each receipt needs its file. An Honor Voucher lifts this rule. The reason is mandatory.
- The **⚠️ HONOR VOUCHER - NO RECEIPT ATTACHED** badge also shows on a report that has no receipt file at all.
- When receipt reading is connected (10.8), **🔍 Read receipt** fills in the merchant, the total and the lines from the attached photo. The member checks every figure before saving.

> **Warning:** check the reason on every Honor Voucher before you sign. The badge shows on the FS, Treasurer and GK desks and in the **Leadership Auditing Queue**.

---

## 7. Performance

### 7.1 Read the executive dashboard

> **Prerequisite (who can do this):** You must be a seated officer or an Admin of the council, or a Super Admin. Only Admins and Super Admins see the audits.

**Goal:** Review one month of council activity.

**Start point:** Sidebar → Performance → **Executive Dashboard**.

**Steps:**
1. Choose the **Month** and the **Year**.
2. Read the four scorecard tiles.
3. Read the **Budget tracking** gauges.
4. Admins: read **Executive audits** for no-shows and shifts that need hours.

<!-- KEEP_IMAGE: executive dashboard capture -->
![Executive Dashboard Summaries (/dashboard)](../generated/dashboard_visual_catalog/dashboard.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: executive audits placeholder -->
![Image: Executive Audits]
<!-- /KEEP_IMAGE -->

**Expected result:** The tiles show four measures.

| Tile | Measures |
| --- | --- |
| **Total labor hours** | Shift hours plus activity hours in the month |
| **Unique Knights participating** | Members who logged any time in the month |
| **Net balance** | Funds raised minus the month's approved expenses and charity checks |
| **Community outreach** | Actual attendees at the month's events |

A budget gauge turns gold at 85% of the cap. The gauge turns red past 100%.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The hours look low. | Members log shift hours up to 3 months later. | Check the month again later. |
| The gauges show no caps. | The budget is not approved. | Approve the budget (6.13). |

### 7.2 Read the growth and hours charts

> **Prerequisite (who can do this):** You must be a seated officer or an Admin of the council, or a Super Admin.

**Goal:** See membership growth and labor hours over 12 months.

**Start point:** Sidebar → Performance → **Growth & Hours Charts**.

**Steps:**
1. Read the new-members chart. The chart counts active members by join month.
2. Read the labor-hours chart.

**Expected result:** Each chart shows one bar per month.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A new member is missing. | The member has no join date. | Run the Supreme roster sync (10.3). |

### 7.3 Record an event's results

> **Prerequisite (who can do this):** You must be the event owner, an elected officer or Admin of a council linked to the event, or a Super Admin. Other members do not see the event on the ledger.

**Goal:** Close out an event with attendance, funds and lessons.

**Start point:** Sidebar → Performance → **Post-event Ledger** → **Active queue**.

**Steps:**
1. Choose the event with **Results needed**.
2. Enter **Actual attendees**. The event's costs come from the expense reports linked to it, not from this page.
3. Enter **Cash raised ($)** and **Electronic raised ($)** if the fields are open.
4. Write **Highlights** for the monthly summary.
5. Select **Save results**.
6. Add lessons: choose a **Category**. Write **What did we learn?**. Select **Add lesson**.

<!-- KEEP_IMAGE: post-event ledger capture -->
![Post-event Ledger (/ledger)](../generated/dashboard_visual_catalog/ledger.png)
<!-- /KEEP_IMAGE -->

**Expected result:** A message shows *"Results saved."* The event moves to **Historic archive**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The cash fields show **Synced from donations**. | Donations drive the totals. | Correct the donations (6.10). |

### 7.4 Mark or clear a no-show

> **Prerequisite (who can do this):** You must be an Admin of a council linked to the event, or a Super Admin.
> **Warning:** a no-show shows in the member's history and in the executive audits.

**Goal:** Record that a volunteer missed a shift.

**Start point:** Sidebar → Performance → **Post-event Ledger** → the event → **Fraternal Volunteer Turnout Summary**.

**Steps:**
1. Select **Mark no-show** on the volunteer's row.
2. Choose the reason.
3. Select **Confirm**.
4. To remove a mistake, select **Clear** on the row.

**Expected result:** The row shows a red edge and a **No-show** pill.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| **Mark no-show** is missing. | The volunteer logged hours, or the event is not linked to your council. | Correct the hours first. |

### 7.5 Search the lessons registry

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.

**Goal:** Learn from other councils' events.

**Start point:** Sidebar → Performance → **Lessons Registry**.

**Steps:**
1. Filter by text, dates, councils or categories.
2. Read the lessons. Your council's lessons show in gold.

<!-- KEEP_IMAGE: lessons registry capture -->
![Lessons Registry (/lessons-registry)](../generated/dashboard_visual_catalog/lessons-registry.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The newest events show first.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| You cannot edit a lesson here. | The registry is read only. | Edit the lesson on the **Post-event Ledger**. |

---

## 8. Resources and the Google Drive archive vault

### 8.1 Concept: backend logic of the Drive archive vault

The vault files council documents in the council's shared Google Drive. The vault has one root folder and three sub-folders.

| Folder path | Holds | Filled from | Accepted files |
| --- | --- | --- | --- |
| `Fraternal Enterprise Suite / Minutes` | Meeting minutes | **Meeting Center** → **Upload minutes** | PDF, text, Word |
| `Fraternal Enterprise Suite / Vouchers` | Expense receipts | **My Expense Reports** | PDF, images |
| `Fraternal Enterprise Suite / Media` | Event photos and video | **Fraternal Photo Gallery** | Images, video, PDF |

The vault follows five rules.

1. Only Admin and Super Admin uploads go to the vault.
2. The largest accepted file is 25 MB.
3. The record stores only the Drive file id. The id goes in the record's existing link column.
4. The web server holds the Drive credentials. The browser never sees the credentials.
5. Live uploads are off by default. The server needs four settings to turn uploads on.

| Server setting | Value |
| --- | --- |
| `GOOGLE_DRIVE_CLIENT_EMAIL` | The service account email |
| `GOOGLE_DRIVE_PRIVATE_KEY` | The service account private key |
| `GOOGLE_DRIVE_SHARED_DRIVE_ID` | The shared drive id. The service account must be a Content manager. |
| `DRIVE_VAULT_LIVE` | `1` |

> **Security warning:** the portal has no server-side sessions yet. The upload route cannot confirm that the caller is an Admin.
> Set `DRIVE_VAULT_LIVE=1` only behind an authenticating proxy. Without the four settings, the screen keeps a browser link for the file.

### 8.2 Turn on live Drive uploads

> **Prerequisite (who can do this):** You must be the platform's server operator. A Super Admin approves the change.
> **Warning:** an open upload route lets anyone who reaches the server write files to the shared drive.

**Goal:** Send Admin uploads to the shared Google Drive.

**Start point:** The web server's environment settings.

**Steps:**
1. Create a Google service account.
2. Add the service account to the shared drive as a Content manager.
3. Set `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY` and `GOOGLE_DRIVE_SHARED_DRIVE_ID`.
4. Put the portal behind an authenticating proxy.
5. Set `DRIVE_VAULT_LIVE` to `1`.
6. Restart the web server.

**Expected result:** A new Admin upload creates a file under `Fraternal Enterprise Suite`.

A council can use its own Drive private key instead of the server key. A council Admin saves the key on the **Credentials Vault** page (10.8).

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| Files stay as browser links. | A setting is missing, or `DRIVE_VAULT_LIVE` is not `1`. | Check all four settings. |
| *"… is larger than 25 MB."* | The file is too large. | Compress or split the file. |

### 8.3 Open the Council Archive Vault folder

> **Prerequisite (who can do this):** You must be a seated officer, a council Admin or a Super Admin. Members do not see the link.

**Goal:** Open the council's shared Google Drive folder.

**Start point:** Sidebar → Resources → **📂 Council Archive Vault**.

**Steps:**
1. Select **📂 Council Archive Vault**.

**Expected result:** The Drive folder opens in a new browser tab.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| Google Drive refuses access. | Drive sharing settings decide who opens the folder. | Ask the folder owner to share the folder with you. |

### 8.4 Share photos and council artifacts

> **Prerequisite (who can do this):** You must be a signed-in member to read both pages. You must be an Admin or a Super Admin to upload to the gallery vault.

**Goal:** Publish event photos, flyers and minutes for the council.

**Start point:** Sidebar → Resources → **Fraternal Photo Gallery** or **Council Artifacts**.

**Steps:**
1. In the gallery, choose the **Event**.
2. Drag photos onto **Drag and drop photos here**.
3. In **Council Artifacts**, filter the cards with **Show**.

<!-- KEEP_IMAGE: photo gallery capture -->
![Photo gallery (/gallery)](../generated/dashboard_visual_catalog/gallery.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The photos show in the slideshow. **Council Artifacts** shows a card for each meeting flyer, set of minutes, event flyer and event photo album.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A council artifact card is missing. | The meeting or the event has no Drive link. | Add the link on the meeting or the event. |

### 8.5 Ask the Microsoft Co-Pilot for collateral

> **Prerequisite (who can do this):** You must be a seated officer, a council Admin or a Super Admin. Other members do not see the **Marketing Factory**.
> **Warning:** the Microsoft Co-Pilot is an AI service from Microsoft (Copilot Studio). The portal sends your request and the facts of the chosen event to Microsoft.

**Goal:** Get a draft of a notice, a post or other collateral for a council event.

**Start point:** Sidebar → Resources → **Marketing Factory**.

**Steps:**
1. Choose the **Event**.
2. In **🤖 Ask Microsoft Co-Pilot to Design Advanced Collateral**, type what you need. The limit is 2,000 characters.
3. Select **Design Advanced Collateral**. The answer can take up to 30 seconds.
4. Read **The co-pilot's draft**. Check every fact, date and name.
5. Select **Copy the draft**.

**Expected result:** The draft shows under the prompt box.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| **Design Advanced Collateral** is grey. Its tooltip says *"The Microsoft Co-Pilot is not connected yet"*. | The council has no Co-Pilot key in the Credentials Vault. | Select the tooltip's link to the Credentials Vault. A council Admin saves the key there (10.8). |
| *"Microsoft refused the saved Co-Pilot key."* | The key was changed or removed in Copilot Studio. | Ask a council Admin to save the new key (10.8). |
| *"The Microsoft Co-Pilot did not answer in time."* | The agent took more than 30 seconds. | Type a shorter request. Try again. |
| **Rewrite in plain, warm words** shows. | The draft uses business jargon. | Edit the words before you use the draft. |

---

## 9. Answers

### 9.1 Read the feedback inbox

> **Prerequisite (who can do this):** You must have Super Admin privileges.

**Goal:** Read members' feedback and bug reports.

**Start point:** Sidebar → Answers → **Online Help Center** → **Feedback inbox**.

**Steps:**
1. Scroll below **Submit System Feedback or Bug Report**.
2. Read each report. The newest report shows first.

<!-- KEEP_IMAGE: online help center capture -->
![Online Help Center with the Feedback inbox (/help)](../generated/dashboard_visual_catalog/help.png)
<!-- /KEEP_IMAGE -->

**Expected result:** Each report shows the sender's name, council, phone, email and time (UTC).

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The inbox is missing. | Only Super Admins see the inbox. | Ask a Super Admin. |

### 9.2 Publish a standard operating procedure

> **Prerequisite (who can do this):** You must be a platform maintainer with write access to the code repository.
> **Warning:** the SOP Center reads the files when the portal is built. A new SOP shows only after a rebuild.

**Goal:** Add a procedure to the **SOP Center**.

**Start point:** The repository folder `docs/sop/`.

**Steps:**
1. Create a Markdown file in `docs/sop/`.
2. Start the file with a `# ` title.
3. Write each task with **Goal**, **Start point**, **Steps**, **Expected result** and **Common problems**.
4. Rebuild the web portal.

**Expected result:** The SOP shows in Sidebar → Answers → **SOP Center**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The SOP is missing. | The portal was not rebuilt. | Run the web build again. |
| A test fails. | The SOP lacks a title or one of the five headings. | Add the missing heading. |

The SOP Center holds the full procedure: **Publish a standard operating procedure**.

---

## 10. Setup and the Supreme roster sync

### 10.1 Add a member

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.
> **Warning:** **Add member** sends a welcome email with a setup code at once.

**Goal:** Put a new Brother Knight on the roster.

**Start point:** Sidebar → Setup → **Affiliated Roster**.

**Steps:**
1. Select **Add member**.
2. Fill in the form. **Email (also the login)** is the member's sign-in name.
3. Choose the **Member type**. Admins grant Admin or Member. Only a Super Admin grants Super Admin.
4. Optional: tick **Designated Budget Director**.
5. Select **Add member**.

<!-- KEEP_IMAGE: affiliated roster capture -->
![Affiliated Roster (/members)](../generated/dashboard_visual_catalog/members.png)
<!-- /KEEP_IMAGE -->

**Expected result:** A message confirms that a welcome email was queued. The member shows a **🆕 New Member** badge for 180 days.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The new member cannot create a password. | The setup code expired after 14 days, or the email is wrong. | Check the email. Select **Send new setup code**. |
| You cannot move a member to another council. | Admins act on their own council only. | Ask a Super Admin. |

### 10.2 Send a new setup code

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.
> **Warning:** a new code replaces the old code.

**Goal:** Help a member who lost or used up the setup code.

**Start point:** Sidebar → Setup → **Affiliated Roster** → the member.

**Steps:**
1. Open the member's record.
2. Select **Send new setup code**.

**Expected result:** The member gets a new welcome email. The new code is valid for 14 days.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The member already has a password. | A registered member does not need a code. | Tell the member to use **Forgot Password?**. |

### 10.3 Concept: backend logic of the Supreme roster sync

The sync reads the roster export from Supreme Headquarters. The sync adds new members and updates join dates.

- The input is a CSV file with a header row. Save the Supreme Excel export as CSV first.
- The columns are Member Number, First Name, Last Name, Email, Phone, Street, Street 2, City, State, Zip, Birth Date, Degree, Date Joined and Charter Member.
- Admins can download a ready Excel roster template with drop-down lists (14.8).
- Header case and spacing do not matter.
- The file must have the member number, the names, the email and the join date columns.

| Row type | What the sync does |
| --- | --- |
| A new member number | Adds the member with the join date. Sends the welcome email with the Expo Go steps and a setup code. |
| A member number already on the roster | Updates the join date only. Other fields stay unchanged. |
| A row that fails a check | Skips the row. The result names the reason. |

A setup code has 20 characters, expires after 14 days and works one time. The platform stores only a hash of the code.
The platform has no background scheduler. An Admin runs the sync by hand.

### 10.4 Run the Supreme roster sync

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges. The Treasurer and the FS see the page but not the roster panel.
> **Warning:** each new row sends a welcome email at once.

**Goal:** Bring the Supreme roster into the platform.

**Start point:** Sidebar → Setup → **Supreme Council Sync** → **Supreme roster sync - new member onboarding**.

**Steps:**
1. Save the Supreme Excel export as a CSV file.
2. Choose the file in **Roster file**. You can also paste the rows in **…or paste the export**.
3. Check the row count on the button.
4. Select **Sync *n* roster rows from Supreme**.
5. Read the skipped rows and the reasons.

<!-- KEEP_IMAGE: supreme sync capture -->
![Supreme sync (/supreme-sync)](../generated/dashboard_visual_catalog/supreme-sync.png)
<!-- /KEEP_IMAGE -->

**Expected result:** A message counts the new members, the updated join dates and the skipped rows. Each new member shows a **🆕 New Member** badge.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The file is refused. | A required column is missing. | Add the missing column header. |
| A row is skipped. | The row has a bad email or a missing value. | Correct the row. Sync again. |

### 10.5 File Form 1728 or Form 1295 with Supreme

> **Prerequisite (who can do this):** You must be a council Admin, the Financial Secretary, the Treasurer or a Super Admin.
> **Warning:** **Transmit Report to Supreme via Alchemer API** sends the report to Supreme.

**Goal:** File a Supreme report from the council's records.

**Start point:** Sidebar → Setup → **Supreme Council Sync**.

**Steps:**
1. Choose the **Supreme form**.
2. Choose a completed **Reporting period**. Form 1728 covers a calendar year. Form 1295 covers a half-year.
3. Check the figures in **Simulate and Audit Compliance Report**.
4. Enter the **Alchemer survey id**.
5. Select **Transmit Report to Supreme via Alchemer API**.

**Expected result:** The attempt shows in **Sync history**. A gold dot marks success. A red dot marks a failure with the reason.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The period is not offered. | The period has not ended. | Wait for the period end. |
| *"The transmission failed and was logged"* | Supreme refused the post. | Read the reason. Correct the figures. Transmit again. |

### 10.6 Find members with a trade skill

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.
> **Warning:** **Send to *n* members** sends a message at once.

**Goal:** Find and message members with a skill.

**Start point:** Sidebar → Setup → **Affiliated Roster** → **Skills**.

**Steps:**
1. Choose a skill in the **Council skills** drawer.
2. Read **Members with *skill***.
3. Optional: write a note. Select **Send to *n* members**.

<!-- KEEP_IMAGE: skills filter drawer placeholder -->
![Image: Skills Filter Drawer]
<!-- /KEEP_IMAGE -->

**Expected result:** Active members with the skill get the message. Replies arrive in **Council Messages & Alerts**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| *"No member of this council has recorded a skill yet."* | Members have no skills on file. | Ask members to add skills in **My Profile**. |

### 10.7 Keep the council lookup tables

> **Prerequisite (who can do this):** You must be a council Admin or a Super Admin for every tab. The Treasurer and the FS may edit the donation tabs and **Budget categories** only.
> **Warning:** **Save changes** saves every row together. One refused row saves nothing.

**Goal:** Keep the council's own lists.

**Start point:** Sidebar → Setup → **Council Lookup Tables**.

**Steps:**
1. Open the tab: **Activities**, **Donation types**, **Enabled donation methods**, **Budget categories** or **Meeting Agenda Templates**.
2. Edit the rows. Each changed row shows **Edited**.
3. For a QR method, paste the image link in **QR code image URL**.
4. Select **Save changes**.

<!-- KEEP_IMAGE: council lookup tables capture -->
![Council Lookup Tables (/council-lookups)](../generated/dashboard_visual_catalog/council-lookups.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The changes save. Phones show the new values on the next load.

The outbound email settings are not on this page. Set them on the **Credentials Vault** page (10.8). The base dues rate is not on this page either. A Super Admin sets the rate on **Global Governance Matrices** (10.9).

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| *"Your role cannot maintain this council's lookups."* | You are on another council, or you have no finance role. | Ask a council Admin. |
| A budget category will not delete. | Budget lines use the category. | Move the lines to another category. |

### 10.8 Connect the council email, Google Drive, Microsoft Co-Pilot and receipt reading

> **Prerequisite (who can do this):** You must be a council Admin or a Super Admin to save or remove a connection. Seated officers see the status lines only. Other members do not see the **Credentials Vault**.
> **Warning:** **Remove** deletes the saved password or key at once. The council goes back to the portal default.

**Goal:** Connect the council's own mail account, Google Drive, Copilot Studio agent and Azure receipt reader.

**Start point:** Sidebar → Setup → **Credentials Vault**.

**Steps:**
1. Read the status lines at the top. A line with ✓ is a connection that is on.
2. For email, go to the **Outbound email** panel.
3. Choose the **Email service**. Google Workspace and Microsoft 365 fill in the **Mail server**.
4. Enter the **Sign-in email** and the **Password**. Use an app password if the service asks for one.
5. Select **Save**.
6. For Google Drive, paste the key in **Drive key** in the **Google Drive** panel. Select **Save**.
7. For the Microsoft Co-Pilot, paste the Direct Line secret in **Co-Pilot key**. Select **Save**. Copilot Studio shows the secret under Settings → Security → Web channel security.
8. For receipt reading, open the council's Azure Document Intelligence resource in the Azure portal. Go to **Keys and Endpoint**.
9. Paste the endpoint in **Azure endpoint**. Select **Save**. The endpoint looks like `https://name.cognitiveservices.azure.com/`.
10. Paste **KEY 1** in **Azure key**. Select **Save**.

**Expected result:** The status line of each saved connection shows ✓. **Receipt reading** shows ✓ only when both Azure values are saved. The page never shows a saved password or key again.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The panels are missing. | You are an officer but not an Admin. | Ask a council Admin. |
| A message about the mail server or the sign-in email shows. | The mail server name or the email is not valid. | Copy both values from your mail service. |
| Saved keys stop working after a server restart. | The server has no fixed vault secret. | Ask the server operator to set `CREDENTIALS_VAULT_SECRET`. Save the keys again. |
| A message says the endpoint must be a cognitiveservices.azure.com address. | The value is not the Azure endpoint. | Copy **Endpoint** from **Keys and Endpoint**. |

### 10.9 Keep the global lists, councils, parishes and charities

> **Prerequisite (who can do this):** You must be a Super Admin for **Global Governance Matrices** and **Councils**. You must be a council Admin or a Super Admin for **Parish & Pastors Linkage**. You must be a charity registry keeper for **Global Charities Registry**.
> **Warning:** a value marked **Built in** cannot be renamed or deleted.

**Goal:** Keep the lists that every council shares.

**Start point:** Sidebar → Setup.

**Steps:**
1. Open the page.
2. Edit the row.
3. Save.

<!-- KEEP_IMAGE: global governance matrices capture -->
![Global Governance Matrices (/lookups)](../generated/dashboard_visual_catalog/lookups.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: councils capture -->
![Councils (/councils)](../generated/dashboard_visual_catalog/councils.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: parishes and pastors capture -->
![Parishes and pastors (/parishes)](../generated/dashboard_visual_catalog/parishes.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: global charities registry capture -->
![Global Charities Registry (/charities/registry)](../generated/dashboard_visual_catalog/charities_registry.png)
<!-- /KEEP_IMAGE -->

A Super Admin also sets each council's base dues rate and tenant type in the **Global Council Parameters Dashboard**, at the top of **Global Governance Matrices**.

**Expected result:** Every council sees the new value.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| Finance officers lost access. | A role named Treasurer or Financial Secretary was renamed. | Restore the exact role name. |

---

## 11. Data protection rules

- **Nothing cascades.** The platform refuses to delete a record that other records use. The message names the record in use.
- Examples: a shift with sign-ups, a member with logged hours, a lookup value in use.
- One exception: a deleted distribution list also deletes the list's member entries.
- **Time windows** protect records. Shift hours close after 3 months. Activity hours close after 6 months.
- **Approved budgets** are frozen for everyone.

---

## 12. Troubleshooting reference

| Symptom or message | Cause | Fix |
| --- | --- | --- |
| A page is missing from the sidebar | Your role has no access, or a feature flag is off. | Check section 1 and section 3. |
| An officer desk is missing from the sidebar | Your role cannot open the desk. | Ask the seat holder. |
| *"…cannot …"* refusal on save | You act outside your council or role. | Switch the **Council** selector, or ask a Super Admin. |
| Delete refused (record in use) | Other records depend on the record. | Clear the dependants first, or keep the record. |
| Shift date refused | The date is outside the event dates. | Adjust the shift date or the event dates. |
| Cash fields locked on the ledger | Donations drive the totals. | Correct the donations. |
| Budget inputs greyed out | The year is **Not Yet Open**, **Finalized** or **Approved**. | Edit only from May 1 to June 30. |
| **Transparency view** on the budget | You are not a budget editor. | Ask a council Admin to tick **Designated Budget Director**. Sign in again. |
| New member cannot create a password | The setup code expired or the email is wrong. | Select **Send new setup code**. |
| Roster sync file refused | A required column is missing. | Check the CSV header (10.3). |
| Drive uploads stay as browser links | Live uploads are off. | See 8.2. |
| **Edit bylaws** missing | You are not the GK or an Admin. | Ask the Grand Knight. |
| *"Decide the open ballot first"* | A ballot is still open. | Decide the open motion. |

Quick answers are also in **Answers → Online Help Center**.

---

## 13. Automated messages reference

> **Delivery in this version:** the platform prepares emails and texts. The email and text services are not connected yet.
> High-priority alerts always reach each recipient's bell. Use the screens in the **Where to follow** column.

> **Hybrid messaging rule:** an email or a text is only a short nudge. The nudge sends the member back to the platform.
> Conversations stay in **Council Messages & Alerts**. Audit notes stay in the **General Ledger** and on the desks.
> Decisions stay on the status tags and desks. No dollar amount, audit finding or private reason goes by email or text.

### Charity grant requests

| Step | Message | Recipient | Where to follow |
| --- | --- | --- | --- |
| Request filed | A tracking message with the three steps and the follow-up date | The Knight Shepherd | **Charity Vetting Queue** |
| 1. Vetting | None | — | **Charity Vetting Queue** |
| 2. Presentation | None | — | The meeting agenda and the **Live Meeting Console** |
| 3. Disbursement | None | — | **Charitable Disbursements Ledger** |
| 6 months after filing | The Trustees ask the Shepherd for a status report. The app sends no reminder. | The Trustees | The date in the Shepherd's tracking message |

### Expense reports

The platform sends no message when an expense report changes status. The member reads the status tag. Officers follow the desks (6.1).

### Volunteer service and onboarding

| Trigger | Message | Recipient | Where to follow |
| --- | --- | --- | --- |
| A shift starts in 24 hours | A reminder email with a calendar file | Every volunteer on the shift | The event's shift roster |
| A meeting starts in 24 hours | A reminder email with a calendar file and the agenda | Every invitee | **Meeting Center** |
| Day 5 after a shift with no hours | A text reminder | The volunteer | **Executive Dashboard** → **Shifts awaiting hours** |
| Every 7 days after that | A follow-up text, until the shift is 3 months old | The volunteer | Same panel. The row shows **Closed** when the window ends. |
| An officer sends an urgent alert | A phone push alert and a bell entry, kept 6 months | Members with the chosen skills or shifts | **Council Messages & Alerts** → **Dispatch High-Priority Push Notification Alert** |
| A member is added or synced | A welcome email with the app steps and a setup code | The new member | The confirmation on **Affiliated Roster** or **Supreme Council Sync** |
| A member requests a password reset | An email with a 6-digit code, valid 15 minutes | The member | None. The member resets the password alone. |

Only the Financial Secretary, the Treasurer, council Admins and Super Admins see the urgent alert tile.

<!-- KEEP_IMAGE: council messages and alerts capture -->
![Council Messages & Alerts (/messages)](../generated/dashboard_visual_catalog/messages.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: distribution lists capture -->
![My Distribution Lists (/distribution-lists)](../generated/dashboard_visual_catalog/distribution-lists.png)
<!-- /KEEP_IMAGE -->

---

## 14. Member engagement and the roster lifecycle

### 14.1 Concept: the Shared Member Center

The **Shared Member Center** shows every member how the council is doing. The page has no money on it.
Cash, budgets and the general ledger stay on the **Executive Dashboard** and the Finances pages. Plain members cannot open those pages.

| Card | What the card shows |
| --- | --- |
| **Council volunteers** | The month's volunteer count, the hours served and the name of each member who served |
| **Our combined devotions** | The rosaries, hours of adoration and confessions of all members, added together |
| **Top 5 Volunteers Leaderboard** | The 5 active members with the most hours ever logged at council events and activities |
| **My impact** | The reader's own events attended, personal hours, canonization shield and council history |

- The combined devotions show only totals. No card shows the devotions of one member.
- Members with equal hours share a place on the leaderboard.
- A white-label organization does not see the devotions card or the shield.

### 14.2 Open the Shared Member Center

> **Prerequisite (who can do this):** Every active member of the council. A Super Admin opens the page for the Super Admin's own council.

**Goal:** See the council's month and your own impact.

**Start point:** Sidebar → Performance → **Shared Member Center**. On the phone: Home → **Open the Member Center**.

**Steps:**
1. Choose the **Month** and the **Year**. The phone always shows the current month.
2. Read the **Council volunteers** card.
3. Read **Our combined devotions** and the **Top 5 Volunteers Leaderboard**.
4. Read the **My impact** card.

**Expected result:** The cards show the month's volunteers and your own figures.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A volunteer is missing from the month. | The volunteer did not log hours yet. | Ask the volunteer to log the hours. Shift hours close after 3 months. |
| The devotions card shows 0. | No member logged devotions on the phone. | Tell members about **My devotions** on the phone Home screen. |

### 14.3 Concept: personal impact and the canonization shield

The **My impact** card shows three personal measures.

| Measure | How the platform counts the measure |
| --- | --- |
| **Events attended** | The events where the member logged shift hours, each event counted one time |
| **Personal hours** | All shift hours and activity hours the member logged |
| Canonization shield | The member's level, from the logged hours and events against the council's thresholds |

The shield has four levels. A member reaches a level when both the hours and the events meet the level's share.

| Level | Share of both thresholds |
| --- | --- |
| Servant of God | The starting level |
| Venerable | One third |
| Blessed | Two thirds |
| Saint | The full thresholds |

- The default thresholds are 100 hours and 10 events.
- Devotions do not change the shield. The shield counts logged service only.
- The member logs devotions on the phone: Home → **My devotions** → **Log devotions**. Only the member sees the member's own tally.

### 14.4 Set the canonization shield thresholds

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.

**Goal:** Set the hours and events that make a Saint in your council.

**Start point:** Sidebar → Performance → **Executive Dashboard** → **Top 5 Volunteers Leaderboard**.

**Steps:**
1. Find **Canonization shield thresholds** under the leaderboard.
2. Enter the **Hours**. Use a whole number from 1 to 10,000.
3. Enter the **Events**. Use a whole number from 1 to 1,000.
4. Select **Save**.

**Expected result:** The message **Shield thresholds saved.** shows. Every member's shield uses the new thresholds at once.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The thresholds are refused. | A value is 0, a decimal or too large. | Enter a whole number in the allowed range. |
| You do not see the thresholds. | Only Admins and Super Admins set the thresholds. | Ask a council Admin. |

### 14.5 Read the monthly activity overview

> **Prerequisite (who can do this):** You must be a seated officer or an Admin of the council, or a Super Admin.

**Goal:** See the month's volunteers next to the cash collected.

**Start point:** Sidebar → Performance → **Executive Dashboard**.

**Steps:**
1. Choose the **Month** and the **Year**.
2. Read the navy **Monthly activity overview** card.
3. Read the **Top 5 Volunteers Leaderboard** beside the overview.

**Expected result:** The overview shows the volunteer count, the cash collected, the hours served and each volunteer's name.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The cash collected differs from the deposits. | The overview counts the cash raised at the month's events. | Check the **Financial ledger** panel on the same page. |

### 14.6 Concept: the council membership history

The platform keeps a history of every council that a member belongs to. The history does not change when a member moves.

| Event | What the history records |
| --- | --- |
| A member is added or synced | A new membership in the council, from the join date when known |
| A Super Admin moves a member to another council | The old membership closes as **Former**. A new **Active** membership opens in the new council. |
| A status changes in the same council | The open membership shows the new status. **Deceased** or **Former** also closes the membership. |

- A transferred member is always **Active** in the new council.
- A transfer takes the member off the old council's distribution lists.
- A transfer puts the member on the new council's council-wide distribution lists.
- A member marked **Deceased** or **Former** leaves every distribution list.
- A new member joins the council-wide distribution lists of the member's council.
- A member added before the history began shows the current council only, from the join date.

### 14.7 Read a member's council membership history

> **Prerequisite (who can do this):** You must have council Admin privileges for the member's council, or Super Admin privileges. A member reads the member's own history on the **Shared Member Center**.

**Goal:** See every council a member belonged to.

**Start point:** Sidebar → Setup → **Affiliated Roster** → the member.

**Steps:**
1. Select the member's name in the roster.
2. Read the **Council membership history** card under the member form.

**Expected result:** The card lists each council, oldest first, with the status, the date joined and the date left. The current membership shows **current**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| You cannot move a member to another council. | Only a Super Admin moves members between councils. | Ask a Super Admin. |
| The join date shows **Not recorded**. | The member has no join date. | Enter the **Date joined council** on the member form. |

### 14.8 Download the Excel roster template

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.
> **Warning:** each new row sends a welcome email at once when you sync the roster.

**Goal:** Build a roster file by hand in Excel and load the file.

**Start point:** Sidebar → Setup → **Supreme Council Sync** → **Supreme roster sync - new member onboarding**.

**Steps:**
1. Select **Download the Excel roster template**.
2. Open the file in Excel. Row 2 is a sample. Replace the sample with a real member.
3. Fill one row for each member. Use the drop-down lists for **Role**, **Degree** and **Charter Member**.
4. Read the **Instructions** sheet for the rules of each column.
5. Save the **Roster** sheet as CSV (File → Save As → CSV UTF-8).
6. Load the CSV file in **Roster file**.
7. Select **Sync *n* roster rows from Supreme**. Each new member gets a welcome email at once.

**Expected result:** A message counts the new members, the updated join dates and the skipped rows.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A member's office is not set. | The sync does not assign offices from the **Role** column. | Fill offices through the elections and the Grand Knight's appointments. |
| Excel refuses a value. | The value is not on the drop-down list or is not a date. | Choose a value from the list. Enter dates as YYYY-MM-DD. |
| A **Charter Member** mark is missing. | The cell was not **Yes**. | Tick **Charter member** on the member form. |

### 14.9 Run the inactivity sweep

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.
> **Warning:** the sweep changes the status of many members at once. The sweep has no undo button.

**Goal:** Mark members **Inactive** after more than 365 days without logged service.

**Start point:** Sidebar → Setup → **Affiliated Roster**.

**Steps:**
1. Select **Run inactivity sweep** at the top of the page. The sweep starts at once.
2. Read the message. The message names each member marked **Inactive**.

**Expected result:** Each named member shows **Inactive** in the roster.

The sweep follows these rules:
- The sweep checks active members of the type **Member** only. The sweep never changes an Admin or a Super Admin.
- The sweep counts shift hours and activity hours. A member with no hours is measured from the join date.
- The sweep skips a member with no hours and no join date.
- The platform has no background scheduler. An Admin runs the sweep by hand.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A member was marked **Inactive** by mistake. | The member served but did not log hours. | Set the member's **Status** to **Active** on the member form. Ask the member to log hours. |
| A quiet member stays **Active**. | The member has no join date, or is an Admin. | Enter the **Date joined council**. Change an Admin's status by hand. |

---

## 15. Volunteer time quarantine

### 15.1 Concept: the volunteer time quarantine

The volunteer time quarantine protects the council's hour totals from over-reporting.
The platform holds some hour entries for leadership review. A held entry is in quarantine.
A held entry does not count anywhere until a leader clears it. The rule covers these totals:

- The council's monthly summary and the **Executive Dashboard** hours.
- The member's canonization shield and personal hours.
- The **Top 5 Volunteers Leaderboard** and the **Shared Member Center**.

The member sees this message when the platform holds an entry: "... hours sent to leadership review before they count toward your totals."
The message also gives the reason.

### 15.2 Concept: the 5/5 over-reporting rules

The platform holds a regular member's entry when either 5/5 rule applies.

| Rule | The platform holds the entry when | Example |
| --- | --- | --- |
| **5 activities** | The entry is the member's sixth different activity on the same day. | A member logs 5 activities on Saturday. The sixth activity on Saturday goes to review. |
| **5.0 hours** | The entry puts more than 5.0 hours against one activity on one day. | A member logs 3 hours of **Food drive**. A second entry of 2.25 hours on the same day goes to review. |

The two rules count in this way:
- A shift counts on the shift date. A council activity counts on the activity date.
- Held entries count toward both rules. A member cannot split hours to get past a rule.
- A second entry on an activity that the member already logged that day is not a new activity.
- On the phone **Report** tab, taps past a rule go to one held entry. The hours logged before the limit still count.

### 15.3 Concept: the +1 hour shift padding rule

A regular member may report up to 1.0 hour more than the scheduled shift. Set-up and clean-up often take extra time.
The platform holds a shift report that is more than 1.0 hour over the scheduled length.

| Scheduled shift | Largest report that counts at once | Report that goes to review |
| --- | --- | --- |
| 08:00 to 11:00 (3 hours) | 4 hours | 4.25 hours or more |
| 18:00 to 20:00 (2 hours) | 3 hours | 3.25 hours or more |

A shift report of more than 5.0 hours also goes to review under the 5.0-hour rule. A new report on the same shift replaces the member's report that waits for review.

### 15.4 Concept: who the rules do not apply to

The rules apply to regular members only. These members are exempt. The platform always logs their hours at once:

| Exempt member | Why |
| --- | --- |
| Admins and Super Admins | They keep the council records. |
| Elected officers: Grand Knight (GK), Deputy Grand Knight (DGK), Chancellor, Recorder, Treasurer, Warden, Advocate, Inside Guard and Outside Guard | The council elected them to lead. |
| Trustees 1, 2 and 3 | The council elected them too. |
| The owner of the event | The owner runs the shift. The exemption covers only the shifts of the owner's own event. |

Appointed officers, such as the Financial Secretary (FS), follow the rules.

A Super Admin can switch the quarantine off. The Super Admin turns off **Volunteer time quarantine** in the Feature Flags Control Center (section 3).
When the switch is off, every entry counts at once. The desk is hidden. Entries that wait for review stay in quarantine until the switch is on again.

### 15.5 Clear or delete held volunteer time

> **Prerequisite (who can do this):** The Grand Knight (GK), the Deputy Grand Knight (DGK) or an Admin of the council, or a Super Admin. Other members do not see the desk.
> **Warning:** each decision is final. You cannot change a cleared or deleted entry on the desk.

**Goal:** Decide each held entry, so that true hours count and false hours never count.

**Start point:** Sidebar → Performance → **Executive Dashboard** → **🚨 Volunteer Time Quarantine Desk** (at the top of the page).

**Steps:**
1. Read the count of pending entries in the desk header.
2. Read each entry: the member name, the shift or activity, the date and the hours.
3. Read the **Description** that the member wrote. Read the red reason under the description.
4. Ask the member or the event owner about the time when the entry is not clear.
5. Select **[ 🟢 Clear Hours to Ledger ]** for true hours. The hours count in every total at once.
6. Select **[ 🔴 Delete Fraudulent Time ]** for false hours. The hours never count. You cannot undo this.

**Expected result:** The entry leaves the desk. A message confirms the decision. A cleared entry shows in the council's hours and on the member's shield.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The desk is not on the dashboard. | Your role is not GK, DGK or Admin, or the quarantine switch is off. | Ask a Super Admin to check your role and the **Volunteer time quarantine** switch. |
| The desk says "has switched Volunteer time quarantine off". | A Super Admin opened another council, and that council has the switch off. | Turn the switch on for that council, or choose another council. |
| A cleared shift report replaced other hours. | A member has one report for each shift. Clearing writes the held report over the old one. | Ask the member to report the correct hours again. |
| A cleared activity entry is missing. | Someone deleted the activity after the member logged the time. | Restore the activity. Ask the member to log the time again. |
| A member says the hours are lost. | The entry waits on the desk. | Decide the entry. Tell the member that held hours count after a leader clears them. |

---

## Appendix: QR code files

The two onboarding codes are in `apps/web/public/assets/images/qr/`. Print or project the codes for new members.
The phone **Donate** screen shows the collection codes. The phone shows the council's image link first.
When the link is missing or broken, the phone shows the code that ships with the app.

To put a real code in place, replace the file. Keep the file name.

<!-- KEEP_IMAGE: QR code file table -->
| Code | File |
|---|---|
| ![Mobile App Expo Go Sync QR code](../apps/web/public/assets/images/qr/expo-go-sync.png) | `apps/web/public/assets/images/qr/expo-go-sync.png` |
| ![Member Sign-Up QR code](../apps/web/public/assets/images/qr/member-sign-up.png) | `apps/web/public/assets/images/qr/member-sign-up.png` |
| ![ParishSoft collection QR code](../apps/mobile/assets/images/qr/parishsoft-collection.png) | `apps/mobile/assets/images/qr/parishsoft-collection.png` |
| ![Venmo collection QR code](../apps/mobile/assets/images/qr/venmo-collection.png) | `apps/mobile/assets/images/qr/venmo-collection.png` |
| ![Zeffy collection QR code](../apps/mobile/assets/images/qr/zeffy-collection.png) | `apps/mobile/assets/images/qr/zeffy-collection.png` |
| ![Zelle collection QR code](../apps/mobile/assets/images/qr/zelle-collection.png) | `apps/mobile/assets/images/qr/zelle-collection.png` |
<!-- /KEEP_IMAGE -->
