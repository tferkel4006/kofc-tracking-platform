# Knights of Columbus Tracking Platform — Member User Guide

**Audience:** Brother Knights who volunteer, log their hours and collect donations.
**Covers:** the phone app (Home, Shifts, Log time, Donate, Messages) and the member areas of the desktop portal (Member Actions, Communications Hub, My Profile, Online Help Center).

> Council Admins, Super Admins, Treasurers and Financial Secretaries: see [ADMIN_USER_GUIDE.md](ADMIN_USER_GUIDE.md) for the management screens. Officers volunteer too, so everything in this guide applies to you as well.

---

## Contents

1. [Before you start](#1-before-you-start)
2. [Onboarding and setting your password](#2-onboarding-and-setting-your-password)
3. [Finding your way around](#3-finding-your-way-around)
4. [Your dashboard](#4-your-dashboard)
5. [The active shift feed](#5-the-active-shift-feed)
6. [Registering for assignments across councils](#6-registering-for-assignments-across-councils)
7. [Reporting hours through the ledger](#7-reporting-hours-through-the-ledger)
8. [Logging on-screen QR donations](#8-logging-on-screen-qr-donations)
9. [Messages, the fraternal roster and your profile](#9-messages-the-fraternal-roster-and-your-profile)
10. [Troubleshooting quick reference](#10-troubleshooting-quick-reference)

---

## 1. Before you start

- **You cannot register yourself.** Your council's Admin adds you to the roster first, using the email address the council has on file for you. That email is also your sign-in name.
- **Two ways in:**
  - The **phone app** is built for use on the go: signing up for shifts, logging time right after a shift, and taking donations at events.
  - The **desktop portal** (web browser) offers the same member tools in the **Member Actions** hub, plus messages, your profile, and the Online Help Center.
- **One account for both.** The password you create on your phone also signs you into the desktop portal.

![Image: Member Dashboard Setup]

### Get the app

Two codes get you started. Point your phone's camera at one to open it.

| Mobile App (Expo Go) | Member Sign-Up |
|---|---|
| ![Mobile App Expo Go Sync QR code](../apps/web/public/assets/images/qr/expo-go-sync.png) | ![Member Sign-Up QR code](../apps/web/public/assets/images/qr/member-sign-up.png) |
| Open the KofC Tracker phone app in Expo Go. | Ask to join the council. |

The codes for giving by Venmo, Zelle, Zeffy and ParishSoft are on the phone's **Donate** screen (§8.2).

---

## 2. Onboarding and setting your password

### 2.1 First launch on your phone

1. Open the app. You will see **"Welcome. What is your email address?"**
2. Type the email address your council has on file and tap **Continue**.
3. What happens next depends on the roster:

| What you see | What it means | What to do |
|---|---|---|
| **"Welcome, *your name*. Choose a password."** | You are on the roster and have not set a password yet. | Go to step 4. |
| **"Welcome back"** | You already created a password. | Enter it and tap **Sign in**. |
| **"We could not find *email* in the member roster…"** plus a **Contact your council admin** card | That address is not on the roster. | Check for typos and tap **Try a different email**. If it is correct, call or email the admin shown on the card (the council office phone is listed too) and ask to be added. |

4. Enter a password of **at least 8 characters** in **PASSWORD**, type it again in **CONFIRM PASSWORD**, and tap **Create password**.
5. You are signed in. The app **keeps you signed in on this phone**, so you will not see the sign-in screen again until you sign out.

![Image: Onboarding Email Check]

![Image: Create Password Screen]

> **Security note:** passwords are never stored as typed. The platform stores only a one-way SHA-256 fingerprint of your password, so no one, including your Admin, can read it.

### 2.2 Signing in to the desktop portal

1. Open the portal address your council gave you.
2. Enter your **Email** and **Password** and select **Sign in**.
3. If you see *"That email and password do not match a registered member,"* check both fields. If you have never set a password, do the phone onboarding in §2.1 first.

![Image: Portal Sign-In]

### 2.3 Signing out

- **Phone:** tap **Sign out** in the navy header. This also removes the remembered session from the phone.
- **Portal:** select **Sign out** under your name in the top-right corner of the navy header.

---

## 3. Finding your way around

### 3.1 Phone tabs

| Tab | Use it to |
|---|---|
| **Home** | See your upcoming shifts, your no-show badge and your upcoming meetings. |
| **Shifts** | Browse the six-month shift feed and sign up. |
| **Log time** | Report hours for a shift you worked or for a council activity. |
| **Donate** | Record cash, card, QR-code and physical-item donations. |
| **Messages** | Read and reply to council threads. A gold badge counts your unread messages. |

The tab you are on is marked with a **gold bar**.

### 3.2 Desktop portal: Member Actions hub

The first entry in the navy sidebar, under **Self-Service Hub**, is **Member Actions Hub**. It has four tabs:

| Tab | Use it to |
|---|---|
| **My active shifts** | See your upcoming commitments. |
| **Registration desk** | Find shifts that still need volunteers, and register for them. |
| **Fraternal roster** | Look up a Brother Knight's phone and email. |
| **Hour ledger** | Report time and review your shift and activity history. |

The **Self-Service Hub** group also holds **My Expense Reports** and **Propose Charity Grant**. On **Propose Charity Grant** you fill in the organization or ministry, its contact details and the request; you are its Knight Shepherd automatically. When you save, you get a tracking message naming its three steps (**Vetting**, **Presentation** at a council meeting, **Disbursement** of the check), and **My requests** shows which step each request is in. Six months after you file, the Trustees ask for a status report; your messages are in the **Messaging** menu (envelope icon) at the top right: **Council Messages & Alerts** opens your conversations, and **My Distribution Lists** lets you build private lists of fellow members that only you can see. The council-wide lists your Admins share appear there too, read only. **Online Help Center** is the **Help** link (question-mark icon) at the top right of every page, just left of the alert bell. The other groups fold open when you select their heading: **Fraternal Scheduler** has the calendar, meetings, nominations, photo gallery and **Post-event Ledger** (for event owners), and **Financial Ledgers** has the **Annual Budget Projections**. **Executive Action Desks** lists the officers' desks with a gold **Locked** badge, so you can see who runs each one. **My Profile** is not in the sidebar: select your name and photo at the top right, then **My Profile**.

![Image: Member Actions Hub]

---

## 4. Your dashboard

### 4.1 Urgent shift flags

Any shift you are signed up for that starts **within the next 48 hours** is shown in **Secondary Red**:
- On the phone it has a **WITHIN 2 DAYS** tag.
- In the portal's **My active shifts** tab, the row has a red edge and a **Within 48 hours** pill, and the panel header shows how many such shifts you have.

Other upcoming shifts show as **Scheduled**.

### 4.2 The no-show badge

The red **No-shows** badge on your phone's Home tab counts the shifts you were marked absent for **in the past 12 months**, including absences you reported yourself. The badge is outlined when the count is zero and filled red when it is higher. Each no-show drops off once it is more than a year old.

### 4.3 Reporting that you can't make a shift

1. On the phone's **Home** tab, find the shift under **My shifts** and tap **Report absence / no-show**.
2. Under **WHY CAN'T YOU MAKE IT?**, choose a reason.
3. Tap **Confirm absence**, or **Cancel** to leave the shift as it is.

The card then shows **ABSENCE REPORTED** with your reason, and your no-show badge updates.

- You can report absences only for **your own** shifts.
- **Only a council Admin can remove a no-show**, so contact your Admin if you reported one by mistake.
- A shift you have already logged hours for cannot be marked absent.
- Please also tell the event's owner, so they can find a replacement.

![Image: Report Absence]

### 4.4 Upcoming meetings

Meetings you have been invited to are listed under **Upcoming meetings** on Home, with the date, time and location. Officers also see a **Take attendance** button on each meeting.

**Tell the council you are coming.** On the **Meetings** tab, every meeting under **My Invites** has a gold **👍 Count Me In** button. One tap turns it into a green **✓ Attending** banner, and your answer is saved at once. Changed your mind? Tap the green banner to undo it. If the save fails, the button goes back and a message explains why.

A **multi-day assembly** shows its first and last day (for example *Thu, Oct 8 – Sat, Oct 10*) instead of a time, and stays on your list until its last day is over.

![Image: Home Dashboard With Badge]

---

## 5. The active shift feed

The shift feed shows every shift over the **next 6 months** for your council **and its sister (affiliated) councils**. Each shift card shows the event, shift name, date and time, location, and how many volunteers it has.

**Status tags**

| Tag | Meaning |
|---|---|
| **NEEDS *n* MORE** | Still short of its minimum volunteers. |
| **Priority** (gold) | Still needs volunteers, and either nobody has signed up yet or it starts within 7 days. |
| **WITHIN 2 DAYS** (red) | Starts within 48 hours. |
| **FULL** | Has reached its minimum volunteers and is locked. |
| **YOU'RE SIGNED UP** | You are already registered. |

**Filters (phone)**
- **Council:** choose one council number, or all of them.
- **Show full shifts:** full shifts are hidden by default. Turn this on to see them anyway, for example to check a friend's shift.

![Image: Shift Feed Filters]

---

## 6. Registering for assignments across councils

### 6.1 On the phone

1. Open **Shifts**.
2. Optional: filter by **Council**.
3. Tap **Sign up** on the shift you want.
4. A confirmation appears: *"You are signed up for *shift* (*event*)."* The shift now shows **YOU'RE SIGNED UP** and appears on Home.

### 6.2 In the desktop portal

1. Open **Member Actions → Registration desk**.
2. Optional: filter by **Council**. **"All: my council and sister councils"** is the default.
3. The table shows only shifts that are **still short of volunteers**, with the councils sharing each event, how many have signed up, and how many are still needed.
4. Select **Register**. The button becomes a **Registered** pill.

### 6.3 The capacity lock

When a shift's sign-ups reach its **minimum number of volunteers**, it locks automatically:
- The **Sign up** or **Register** button disappears.
- If two members try to take the last place at the same moment, only one succeeds. The other sees a *shift is locked* message.

![Image: Registration Desk]

---

## 7. Reporting hours through the ledger

### 7.1 The 15-minute chunk rule

All time is recorded in **15-minute chunks**, stored as quarter hours:

| You pick | Saved as |
|---|---|
| 0 h 15 min | 0.25 |
| 0 h 30 min | 0.50 |
| 1 h 15 min | 1.25 |
| 2 h 45 min | 2.75 |

- Minutes can only be **:00, :15, :30 or :45**. The pickers offer nothing else.
- A single entry must be **more than 0 and no more than 24 hours**.
- You may report **more time than the shift's planned length**, for example if you stayed to clean up.
- Any other value, such as 1.33 hours, is refused.

### 7.2 Time windows

| You are logging… | How far back you can go |
|---|---|
| A **shift** you worked | Shifts up to **3 months** before today |
| A **council activity** (ongoing work with no sign-up, like parish maintenance) | Dates up to **6 months** before today |

After these windows close, entries are frozen to protect the council's records.

### 7.3 Logging a shift on the phone

1. Open **Log time** and choose **A shift I worked**.
2. **Which shift?** defaults to your most recent shift that is still missing hours. Tap another shift to change it.
3. **How long?** For a shift you have not logged yet, the hours and minutes start at the shift's own length (for example 3 hours for a 9:00-12:00 shift). If you worked the whole shift, just check it and save; otherwise change it.
4. Optional: add **NOTES**.
5. Tap **Save time**. You will see *"Saved 1 hr 15 min (1.25 hours) to *shift*."*

**Logging again replaces** the earlier hours for that shift, so use the same steps to correct a mistake.

### 7.4 Logging an activity on the phone

1. Open **Log time** and choose **An activity**.
2. Pick the **Activity**.
3. Set the **DATE**: tap **Today** or **Yesterday**, or type a date as YYYY-MM-DD.
4. Pick **How long?**, add optional notes, and tap **Save time**.

### 7.5 Logging in the desktop portal (Hour ledger)

1. Open **Member Actions → Hour ledger**.
2. **Report time on a shift:** choose **Shift I worked**. The list reaches back to the date shown in the hint. Pick **Hours** and **Minutes**, add optional notes, and save.
3. **Report time on an activity:** choose the **Council activity** and **Date worked** (within the range the hint shows), pick hours and minutes, and save.
4. **My shift history** shows every past shift with its status:

| Status | Meaning |
|---|---|
| **Logged** | Hours are recorded. |
| **Hours needed** | You worked the shift but have not reported time yet. |
| **No-show** | You were marked absent. |
| **Closed** | The 3-month window has passed. |

5. **My activity history** lists the activity time you have logged.

### 7.6 Reminders

If you signed up for a shift and have not logged hours:
- A friendly text reminder goes out **5 days after the shift**.
- Further reminders go out **once a week** while the hours are still missing.
- Reminders **stop** once the shift is older than 3 months, because hours can no longer be logged for it.

![Image: Log Time Picker]

![Image: Hour Ledger History]

---

## 8. Logging on-screen QR donations

The **Donate** tab lets you take donations at an event, or at any other time, without paper.

### 8.1 Pin the event (recommended at events)

1. Open **Donate** and tap **Start accepting for an event**.
2. Choose the **EVENT**. Only events that have already started are listed, because event donations are taken during or after an event.
3. Optional: set a **DEFAULT AMOUNT**, a **DEFAULT DONATION TYPE** and a **DEFAULT DESCRIPTION**. These pre-fill every donation form.
4. Tap **Start**. A gold **ACCEPTING DONATIONS** card shows the event, plus this phone's running count and total.

If you don't pin an event, donations are recorded as **standalone** (not linked to any event).

### 8.2 Record a donation

1. Under **How is the donor giving?**, tap the tile for the donor's method:

| Tile hint | Methods | What happens |
|---|---|---|
| **Record the amount** | Cash, and any other method your council adds | Enter the amount. |
| **Record the charge** | Credit Card | Enter the amount charged. |
| **Show the QR code** | Venmo, Zelle, Zeffy, ParishSoft | A full-screen pop-up shows only that channel's QR code. |
| **Describe and value** | Physical items | Describe the items and estimate their value. |

2. **For a QR payment:**
   1. Turn the phone toward the donor so they can scan **"Scan to pay with *method*"**. Each tile shows only its own code:

| ParishSoft | Venmo | Zeffy | Zelle |
|---|---|---|---|
| ![ParishSoft collection QR code](../apps/mobile/assets/images/qr/parishsoft-collection.png) | ![Venmo collection QR code](../apps/mobile/assets/images/qr/venmo-collection.png) | ![Zeffy collection QR code](../apps/mobile/assets/images/qr/zeffy-collection.png) | ![Zelle collection QR code](../apps/mobile/assets/images/qr/zelle-collection.png) |

   2. Wait until they show you their **payment confirmation**, and check that the amount matches. Tap **Done – record the payment** to close the pop-up (**Show the *method* QR code** opens it again).
   3. Enter the amount, choose the **DONATION TYPE**, and optionally add the donor's name and a description.
   4. Tap **Record donation**.
3. You will see *"Recorded $20.00 by Venmo for *event*. Thank the donor!"*
4. **Recorded for this event** lists the event's latest donations **from every phone**, so helpers at the same table can see each other's entries.

### 8.3 If the QR code does not appear

Venmo, Zelle, Zeffy and ParishSoft always show a code: your council's own, or the one that comes with the app if your council has not added one or it cannot be loaded. These messages apply only to another QR method your council adds:

- *"Your council has not uploaded this QR code yet."* An Admin or finance officer needs to add the code's image link under **Council Lookup Tables → Enabled donation methods**.
- *"The QR code could not be loaded."* The phone may be offline, or the link may be broken.
- In either case, **take the donation another way** (cash or card) and tell your Admin.

### 8.4 Physical items

Choose **Physical items**. Fill in **WHAT WAS DONATED** (for example *"3 boxes of canned food"*), which is required, and an **estimated value**. Item donations are recorded but **do not** count toward the event's cash or electronic funds.

### 8.5 Finish the session

When the event is over, tap **Stop accepting – the event is over**. New donations will be standalone again.

### 8.6 Correcting a donation

Contact your council's Treasurer, Financial Secretary or Admin. You may also correct donations you recorded yourself, and event owners may correct donations to their own event, from the portal's Donations screen if you have access to it.

![Image: Donate Method Tiles]

![Image: QR Code Presentation]

---

## 9. Messages, the fraternal roster and your profile

### 9.1 Communications Hub / Messages

- Tap a message to open its thread. Replies stay together under the original message.
- Attachments such as PDFs, spreadsheets and photos are listed on their message and stay in the thread for later reference. On the phone, attachment previews are not available in this version.
- The **Messages** tab badge shows how many messages you haven't read yet.

### 9.2 Fraternal roster (portal)

Open **Member Actions → Fraternal roster** and use **Search by name or number**. The roster lists active Brother Knights of your council and its sister councils, with their **phone and email**.

### 9.3 My Profile (portal)

Open it from the member menu: select your name and photo at the top right of the portal.

- **Photo:** select **Choose photo…** and pick an image; it is saved at once and shown in the header. A square photo of at least 320 × 320 pixels stays sharp on high-resolution screens. **Remove photo** goes back to your initials.
- **My fraternal biography:** write a short biography (up to 2,000 characters), then select **Save biography**.
- **Contact details:** update your phone, email and address, then select **Save contact details**. **Changing your email also changes your sign-in email.**
- **Working status, skills and training:** record trade skills (for example electrician or carpenter) so Admins can find you when a project needs them.
- Your name, member number, degree and member type are kept by your council's Admins. Ask them to correct these.

![Image: My Profile Skills]

---

## 10. Troubleshooting quick reference

| Message or symptom | Cause | Fix |
|---|---|---|
| *"We could not find … in the member roster"* | Your email is not on the roster, or has a typo. | Tap **Try a different email**, or contact the admin shown. |
| *"The two passwords do not match."* | The confirmation differs from the password. | Type both again. |
| Password refused when creating it | It is shorter than 8 characters. | Choose a longer password. |
| *"Incorrect password. Please try again."* | Wrong password. | Try again. If you have forgotten it, ask your council Admin to help. |
| No **Sign up** button on a shift | The shift is **FULL** (capacity lock). | Choose another shift, or ask the event owner whether more help is needed. |
| *"Every shift for this filter has its volunteers."* | Only full shifts match your filter. | Change the council filter or turn on **Show full shifts**. |
| Hours refused as an invalid increment | The value is not a 15-minute multiple. | Use the pickers (:00, :15, :30, :45). |
| Shift not listed on **Log time** | It is more than 3 months old. | The window has closed. Contact your Admin if a record is wrong. |
| Activity date refused | The date is more than 6 months ago. | The window has closed. |
| *"Your council has not enabled any donation methods yet."* | No methods are enabled for your council. | Ask an Admin, Treasurer or Financial Secretary to enable them. |
| QR code missing | No QR image is on file. | See [§8.3](#83-if-the-qr-code-does-not-appear). |
| Portal sign-in fails | Wrong email or password, or no password set yet. | Do the phone onboarding first (§2.1). |
| Reported an absence by mistake | Members cannot remove a no-show. | Ask your council Admin to clear it. |

Still stuck? Select **Help** (the question-mark link at the top right of the portal) to open the **Online Help Center**, or message your council's Admin through the Communications Hub.

### Sending feedback or reporting a bug

In the portal, open **Online Help Center** and scroll to **Submit System Feedback or Bug Report**. Your name, council, phone and email are filled in for you and cannot be edited there (change them in **My Profile**). Describe what happened in the box, up to 2,000 characters, and select **Send feedback**. Reports go to the platform's Super Admins.
