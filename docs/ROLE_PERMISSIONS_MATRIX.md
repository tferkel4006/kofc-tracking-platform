# Role Permissions Matrix

A governance guide for the council's trustees. It shows what each council rank may do in five parts of the Knights of Columbus tracking platform. Every entry below matches a rule the data service enforces, or the screen that offers the control. The notes name the rule so it can be checked in the code (`packages/shared/src/permissions.ts` for the screens, `rules.ts` and the module files for the data service).

Current as of Sprint 5Z-2.5.

## How to read this chart

| Mark | Meaning |
| :-: | --- |
| ✅ | Allowed |
| 👤 | Allowed for the member's **own** records only |
| 🗓️ | Allowed only inside a time window (see the note) |
| 👁️ | Read-only |
| — | Not allowed |

**Ranks are cumulative only where stated.** The Financial Secretary, Treasurer and Grand Knight are **officer roles**, held by a member whose account type is usually *Member*. The columns below show a plain *Member* account holding that role. A Council Admin account that also holds an office gets the union of both columns.

**Designated Budget Director** is a flag a Council Admin sets on one member (`Member.IsBudgetDirector`). It is not an officer role.

**Super Admins** (platform staff, not a council rank) may do everything shown for a Council Admin, in every council. The two exceptions are self-approval and self-payout of expenses, which no one may do.

Every permission also requires an **Active** membership status. Inactive members lose write access everywhere.

---

## At a glance

| Module | Standard Member | Budget Director | Financial Secretary | Treasurer | Council Admin | Grand Knight |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| **Expense Ledgers** | 👤 File own | 👤 File own | ✅ Audit + pay | ✅ Audit + pay | ✅ Audit | 👤 File own |
| **Annual Budgets** | 👁️ Read | 🗓️ Draft | 🗓️ Draft + approve | 🗓️ Draft + approve | 🗓️ Draft + approve | 👁️ Read |
| **Messaging Groups** | ✅ Message + groups (phone) | ✅ Message + groups (phone) | ✅ + push alerts | ✅ + push alerts | ✅ + alerts, lists, skill blasts | ✅ Message + groups (phone) |
| **Calendars** | 👁️ Upcoming only | 👁️ Upcoming only | ✅ Full history + schedule meetings | ✅ Full history + schedule meetings | ✅ Full history + plan events and meetings | ✅ Full history + schedule meetings |
| **Attendance Hubs** | 👤 RSVP + own hours | 👤 RSVP + own hours | ✅ Take attendance | ✅ Take attendance | ✅ Attendance + no-shows + audits | ✅ Attendance + agenda templates |

---

## 1. Expense Ledgers

| Action | Standard Member | Budget Director | Financial Secretary | Treasurer | Council Admin | Grand Knight |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| File an expense report and read their own | 👤 | 👤 | 👤 | 👤 | 👤 | 👤 |
| Open the council's audit queue and return a report | — | — | ✅ | ✅ | ✅ | — |
| Open the FS Audit Desk | — | — | ✅ | — | 👁️ | — |
| Issue the written order (first signature) | — | — | ✅ ¹ | — | — | — |
| Open the GK Authorization Desk | — | — | — | — | 👁️ | ✅ |
| Counter-sign the voucher (second signature, approves) | — | — | — | — | — | ✅ ¹ ³ |
| Issue a check (disbursement ledger) | — | — | ✅ ¹ | ✅ ¹ | — | — |
| Record a donation (phone donation desk) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Change or delete a donation | 👤 ² | 👤 ² | ✅ | ✅ | ✅ | 👤 ² |
| Pay a charity check | — | — | ✅ | ✅ | — | — |
| Propose a charity gift | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

1. **Nobody** signs or pays a report they submitted (`SELF_APPROVAL_BLOCKED`, `SELF_PAYOUT_BLOCKED`), including a Super Admin. Checks pay only reports carrying both signatures (Sprint 5Z-4). Rules: `assertMayIssueExpenseOrder`, `assertMayAuthorizeExpenseOrder`, `assertMayAuditCouncilExpenses`, `assertMayDisburseCouncilExpenses`, `assertDualSigned`.
2. A member may change a donation they recorded, or one on an event they own (`canChangeDonation`).
3. **Collusion Guard:** the officer who issued a report's written order may not also counter-sign it (`DUAL_SIGNATURE_CONFLICT`). This matters for a Super Admin, who may sign either line. 👁️ means the Admin can open the desk to follow the work but cannot sign.

## 2. Annual Budgets

| Action | Standard Member | Budget Director | Financial Secretary | Treasurer | Council Admin | Grand Knight |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Read the council's annual budget | 👁️ | 👁️ | 👁️ | 👁️ | 👁️ | 👁️ |
| Draft figures and add custom lines (May 1 - June 30) | — | 🗓️ | 🗓️ | 🗓️ | 🗓️ | — |
| Approve & Finalize the entire budget | — | — | ✅ ³ | ✅ ³ | ✅ ³ | — |
| Budget gauges and historical performance review | — | — | ✅ | ✅ | ✅ | ✅ ⁷ |
| Name the Designated Budget Director | — | — | — | — | ✅ | — |

3. Approval opens on May 1 of the budget year and stays open after the July 1 lock, when councils usually vote. An approved year is frozen for everyone (`BUDGET_YEAR_APPROVED`). A Super Admin may override the drafting window, but never the approval freeze. Rules: `assertMayManageBudgetForecast`, `assertMayApproveBudget`.

## 3. Messaging Groups

| Action | Standard Member | Budget Director | Financial Secretary | Treasurer | Council Admin | Grand Knight |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Message members of their council and affiliated councils | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Send to a built-in group (**All Members**, **Active Officers**) from the phone | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Start a new conversation from the web portal | — | — | — | — | ✅ | — |
| Maintain the council's custom distribution lists | — | — | — | — | ✅ | — |
| Message every member who holds a skill (roster skill filter) | — | — | — | — | ✅ | — |
| Send a high-priority push alert | — | — | ✅ | ✅ | ✅ | — |

The built-in groups are All Members and Active Officers (`DISTRIBUTION_GROUPS`). Every member may register their phone for push alerts and read their own. Rule: `assertMayDispatchCouncilAlerts`.

## 4. Calendars

| Action | Standard Member | Budget Director | Financial Secretary | Treasurer | Council Admin | Grand Knight |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| See the council calendar (events and meetings) | 👁️ ⁴ | 👁️ ⁴ | ✅ | ✅ | ✅ | ✅ |
| See past entries as well as upcoming ones | — | — | ✅ | ✅ | ✅ | ✅ |
| Plan events and shifts (including multi-day events) | — | — | — | — | ✅ | — |
| Schedule meetings (including multi-day assemblies) | — | — | ✅ | ✅ | ✅ | ✅ |
| Upload event photos | 👤 ⁵ | 👤 ⁵ | ✅ | ✅ | ✅ | 👤 ⁵ |
| Save a meeting's Google Drive minutes and flyer links | 👤 ⁵ | 👤 ⁵ | ✅ | ✅ | ✅ | 👤 ⁵ |

4. Members without an office see only what is still ahead (`calendarHidesEnded`).
5. Only on an event or meeting they own.

## 5. Attendance Hubs

| Action | Standard Member | Budget Director | Financial Secretary | Treasurer | Council Admin | Grand Knight |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| RSVP to their own meeting invitation (**Count Me In**) | 👤 | 👤 | 👤 | 👤 | 👤 | 👤 |
| Sign up for shifts and report their own hours | 👤 | 👤 | 👤 | 👤 | 👤 | 👤 |
| Mark their own shift a no-show | 👤 ⁶ | 👤 ⁶ | 👤 ⁶ | 👤 ⁶ | ✅ | 👤 ⁶ |
| Mark or clear anyone's no-show | — | — | — | — | ✅ | — |
| Take meeting attendance and attach minutes | 👤 ⁵ | 👤 ⁵ | ✅ | ✅ | ✅ | ✅ |
| Edit Meeting Agenda Templates (Council Lookups) | — | — | — | — | ✅ | ✅ |
| No-show and awaiting-hours audits (dashboard) | — | — | ✅ ⁷ | ✅ ⁷ | ✅ | ✅ ⁷ |
| Monthly executive summary and Faith-in-Action mission tracking (dashboard) | — | — | ✅ | ✅ | ✅ | ✅ ⁷ |

6. A member may flag their own no-show but never clear one (`assertMayMarkNoShow`).
7. Sprint 5Z-2.5: **every seated officer** of the council (any role with Officer = 1: Grand Knight, Deputy Grand Knight, Chancellor, Recorder, Financial Secretary, Treasurer, Warden, Advocate, the Guards and the three Trustees, the same audience as the Pooled Vetting Desk) opens the executive dashboard in full, read-only (summary, mission tracking, budget gauges and personnel audits), for their own council, without an Admin account type. Directors, the Lecturer and the Chaplain hold no officer seat and do not. The **Grand Knight and Deputy Grand Knight** also run the Pooled Vetting Desk with Admin-level reach. They may annotate, advance or decline a request another officer claimed (`mayOverrideVettingClaim`), though never one they shepherd themselves (Sponsor Restriction). Approving the budget stays with Admins and finance officers. Rules: `EXECUTIVE_ROLE_NAMES`, `assertMayReviewBudgetPerformance`, `assertMayVetCharitableRequests`.

Meeting attendance, minutes and invitations are gated by the screens today (`canManageMeeting`). The data service does not yet take the caller's identity for those three actions. Agenda templates are enforced by the data service (`assertMayManageAgendaTemplates`).
