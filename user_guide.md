🟦 Knights of Columbus Platform: User Guide & Admin Manual
This manual explains how to use and administer the tracking platform. The application adapts its user interface based on the security clearances defined in your member profile.
________________________________________
🗂️ Table of Contents
1.	System Roles & Permissions Matrix
2.	First-Time Member Onboarding Process
3.	Brother Knight Mobile Guide (Low-Click Phone Views)
4.	Council Admin Desktop Manual (Event & Meeting Control)
5.	Super Admin System Adjustments (Lookup Management)
________________________________________
👥 1. System Roles & Permissions Matrix
The platform automatically identifies your administrative boundaries the moment you log into the system:
•	Super Admin: Holds global keys. Maintains lookup tables across all councils, establishes structural roles, managing council-wide system configuration drops.
•	Council Admin / Officer: Manages branch-level data. Handles local membership rosters, builds multi-day events, schedules meetings, uploads minutes, and audits time logs.
•	Member (Brother Knight): Accesses self-service mobile tools. Signs up for shifts, logs fraternal hours against events or ongoing activities, and reviews messages.
________________________________________
🔑 2. First-Time Member Onboarding Process
To maximize security and protect our fraternal roster database, members cannot register themselves from scratch. A Council Admin must pre-load a member's basic info into the database first.
📱 The Onboarding Flow (Step-by-Step)
1.	Launch the App: Open the mobile app. You will be prompted to enter your Email Address.
2.	Roster Check: The system checks your input against the pre-loaded Member table rows.
o	If Found: The app unlocks the Password Configuration Screen. Enter a new secure password (minimum 8 characters). The system hashes it securely with SHA-256 and activates your profile.
o	If Missing: The system freezes execution, halts input fields, and displays your local Grand Knight or Financial Secretary's phone number and email with an alert saying: "No pre-existing roster record found. Please contact your administrator to provision your account."
3.	Stay Logged In: Toggle the "Remember Me" switch on your phone. This securely caches an encrypted session token in your device's keychain storage (expo-secure-store), bypassing the login screen on later app launches.
________________________________________
📱 3. Brother Knight Mobile Guide
The mobile application is optimized for on-the-go utility, minimizing typing fields and screen switches.
🏠 Your Dashboard & Navigating Shifts
•	Urgent Shift Flags: Active assignments scheduled within the next 48 hours are automatically highlighted at the top of your dashboard in Secondary Red (#C8102E) as a reminder.
•	The 1-Year No-Show Badge: A distinct badge sits on your profile header displaying your total running tally of missed commitments over the past 365 days. Avoid letting this increment!
•	6-Month Calendar Feed: Tap the Shifts Feed to view all upcoming council and affiliated council actions.
•	Registering for a Shift: Filter open tasks using the Council Number dropdown. Tap Sign Up to join a slot.
o	Capacity Lock rule: If a shift requires 5 volunteers (MinNumberVolunteers) and 5 brothers have already committed, the shift will display a "Locked" status badge, and the signup button will automatically disappear to avoid over-scheduling.
⏱️ Logging Volunteer Hours
•	Dropdown Increments: To log time, navigate to your completed shifts list. Use the quick scroller to pick hours and minutes (options restricted to :00, :15, :30, :45). The system automatically formats your entry into standard quarters (e.g., 1 hr 15 mins saves as 1.25 behind the scenes).
•	Ongoing Council Activities: Ongoing initiatives (like charitable collections or parish maintenance) don't require advance shift signups. Go to the Activities Tab, select an activity name, pick your hours, and save it instantly.
•	The 3-Month / 6-Month Time Locks:
o	You have up to 3 months to log or correct hours against a shift you missed or completed.
o	You have up to 6 months to adjust entries logged against ongoing untracked council activities. Beyond these windows, entries freeze to protect fiscal and archival records.
💬 Messaging and Attachment Drawers
•	Threaded Communication: To keep main threads clean, tap any main message notice to open a dedicated sub-comment window.
•	Media Vault: Drag and drop PDFs, spreadsheet trackers, or project images straight into your message row. They stay saved in the stream forever for council reference.
•	Follow-Up Flags: Tap a message card and select "Mark as Unread" or "Flag for Later" to drop it into your task tray so priority tasks don't get lost in the scroll.
________________________________________
💻 4. Council Admin Desktop Manual
Council Admins and Officers use the dense desktop grid layout screens to manage localized fraternal programming.
📅 Split-Screen Event Planner
•	Creating Events: Multi-day event frameworks are grouped by categories. Each calendar item requires an owner assigned from your council roster.
•	Copy as Twin Shortcut: To schedule a recurring project (like a monthly pancake breakfast), pull up a past instance inside the database view tracker and click "Copy as Twin". The system clones all structural fields, shift targets, descriptions, and category links, leaving you to simply update the calendar date fields.
•	Post-Event Financial Ledger: Once an event wraps up, select it inside the ledger queue to record structural metrics: input total cash funds vs. electronic payment collections, log physical foot traffic counts, and drop notes into the Lessons Learned Repository sorted by planning category.
🏛️ Meeting Command Center
•	Scheduling Meetings: Create formal council assemblies by selecting a date, time boundary, location, and attaching an agenda brief.
•	Mass Invitations:
o	Click "Invite All Active Members" to automatically cross-reference your council roster and issue mass in-app meeting notices to every member in seconds.
o	Click "Clear All" to instantly uncheck all invitation rows if you need to build a small, specialized committee invite group from scratch.
•	Uploading Minutes: Drag and drop your completed meeting overview PDF directly into the portal dashboard. It updates the system database, allowing members to review minutes right from their phones.
•	Reporting No-Shows: Admins can flag an absent member as a "No-Show" against completed event shifts. Select the missing member, click Record No-Show, and choose the reason code (e.g., Forgot, Wrong Time, Wrong Date) to update their rolling badge metric.
________________________________________
🛠️ 5. Super Admin System Adjustments
Super Admins look after global settings that affect all councils simultaneously across the network.
🎛️ System Configuration Master Tabs
Navigate to the master control panel to manage settings across 8 core tabs:
1.	MemberStatus: Modify or add system definitions (e.g., Active, Inactive, Former, Deceased).
2.	Role: Define local structural officer positions (e.g., Grand Knight, Warden, Trustee) and set their binary officer privilege flags.
3.	Degree: Maintain formal fraternal achievement rankings (First through Fourth).
4.	MemberType: Adjust baseline permissions tiers (Super Admin, Admin, Member).
5.	Category: Set primary tags for events and ongoing activities (Fellowship, Service, Faith Building, Fundraising).
6.	NoShowReason: Track and maintain behavioral reason descriptions for dashboard metric tracking.
7.	LessonsLearnedCategory: Maintain categories for past event documentation (Planning, Budgeting, Execution).
8.	MeetingType: Configure definitions for official gatherings (Regular Monthly, Officer, Community Committee).
________________________________________

