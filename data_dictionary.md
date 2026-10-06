# Knights of Columbus Application Data Dictionary
# 1. Core Lookup Tables
[Credentials]
Stores secure authentication keys. Linked 1:1 with the Member profile during onboarding.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	Username (VARCHAR(50), NOT NULL) — Unique authentication handle (defaults to Member Email).
•	Password (VARCHAR(255), NOT NULL) — Secured cryptographic hash string.
[MemberStatus]
Defines the lifecycle state of a council member.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	Status (VARCHAR(30), NOT NULL) — Allowed values: Active, Inactive, Former, Deceased.
[Degree]
Tracks a Knight's progress through fraternal formation degrees.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	Degree (VARCHAR(10), NOT NULL) — Allowed values: First, Second, Third, Fourth.
[MemberType]
Dictates platform routing and dashboard accessibility tiers.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	Type (VARCHAR(15), NOT NULL) — Allowed values: Super Admin, Admin, Member.
[Role]
Defines fraternal officer designations and leadership status.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	Role (VARCHAR(50), NOT NULL) — Fraternal title string (e.g., 'Grand Knight', 'Warden').
•	Officer (BIT, NOT NULL, DEFAULT 0) — Flag indicator (1 = Officer, 0 = Standard Member).
[NoShowReason]
Standardized classifications for missed volunteer commitments.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	NoShowReasonCode (CHAR(1), NOT NULL) — Single character code identifier (A through E).
•	NoShowReasonDescription (VARCHAR(100), NOT NULL) — Categorized excuse string (e.g., 'Forgot').
[Category]
Global activity categories used to organize events and ongoing tasks.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	Category (VARCHAR(100), NOT NULL) — Categorized label (e.g., 'Fellowship', 'Fundraising').
•	CategoryDescription (VARCHAR(255), NOT NULL) — Explanatory scope criteria text.
[LessonsLearnedCategory]
Organizational pillars used to group institutional knowledge across events.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	LessonsLearnedCategory (VARCHAR(30), NOT NULL) — Pillars: Planning, Budgeting, Scheduling, Marketing, Execution.
[MeetingType]
Standardized categories for structural council gatherings.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	Type (VARCHAR(50), NULL) — Designations: Monthly, Officer, Community.
•	Description (VARCHAR(255), NULL) — Statement outlining meeting requirements.
[WorkingStatus]
Global lookup table classifying a member's current employment profile.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	WorkingStatus (VARCHAR(25), NOT NULL) — Text label: Student, Full Time, Part Time, Retired, Unemployed.
[DonationMethod]
Global lookup table specifying allowed financial tracking channels.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	DonationMethod (VARCHAR(30), NOT NULL) — Text label: Cash, Credit Card, Venmo, Zelle, Zeffy, Parishsoft, Physical Items.
[DonationType]
Multi-tenant lookup configuring council-specific ledger accounts.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
•	DonationType (VARCHAR(100), NOT NULL) — Text label: Parking, Parish Event, Meals, Unsolicited.
[Skill]
Global lookup table cataloging specialized professional trades and tactical skillsets available within the council roster.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing internal identifier.
•	SkillName (VARCHAR(30), NOT NULL) — Text label outlining the trade specialization (e.g., Plumbing, Electrical, Cooking, Finances).
[SkillLevel]
Global lookup table defining mastery tiers for member skill competencies.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing internal identifier.
•	SkillLevel (VARCHAR(30), NOT NULL) — Text label mapping proficiency rank: Novice, Beginner, Intermediate, Senior, Expert.
[KOCTrainingClasses]
Global lookup tracking mandatory safety, structural compliance, and youth protection courses.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing internal identifier.
•	ClassName (VARCHAR(100), NOT NULL) — Official title banner text for the course (e.g., Background Check, Preventing Abuse and Protecting Those We Serve).
[CouncilDonationMethod]
Multi-tenant lookup table detailing which electronic, physical, or cash donation collection strategies are toggled active for an isolated council.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing relational identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id). Maps the config line directly to the local branch entity.
•	DonationMethodID (INTEGER, NOT NULL) — Foreign Key references DonationMethod(id). Locks in the allowed channel link.
•	DonationMethodURL (VARCHAR(255), NULL) — Storage bucket endpoint link holding the static QR code asset for that council's platform profile (Venmo, Zelle, Zeffy, etc.).
[SystemFeedback]
Feedback and bug reports members submit from the web portal's Online Help Center. Readable only by active Super Admins (feedback.listInbox).
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	MemberID (INTEGER, NOT NULL) — Foreign Key references Member(id). The member who sent the report.
•	SubmittedAt (DATETIME, NOT NULL, DEFAULT GETDATE()) — When the report was sent (UTC).
•	FeedbackText (VARCHAR(2000), NOT NULL) — The report text, trimmed; at most 2,000 characters.
________________________________________


________________________________________
# 2. Tenants & Organizational Structure
[Council]
The core multi-tenant anchor entity representing individual local councils.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilNumber (INTEGER, NOT NULL) — Official numerical identity designation.
•	CouncilName (VARCHAR(100), NOT NULL) — Explicit structural naming text.
•	State (VARCHAR(50), NOT NULL) — State jurisdiction abbreviation or name.
•	Phone (VARCHAR(50), NULL) — Optional administrative contact line.
•	Email (VARCHAR(100), NULL) — Optional shared council contact address.
•	flag_mobile_elections (BIT, NOT NULL, DEFAULT 1) — Sprint 6A feature flag: 0 hides officer nominations and the appointed leadership matrix for the council. Appended by ALTER TABLE (schema version 30), like the three flags below.
•	flag_fundraising_inflow (BIT, NOT NULL, DEFAULT 1) — Sprint 6A patch feature flag: 0 hides every public capital intake view - the recorded donations desk and the phone app Donate tab with its event point-of-sale grid, card and QR collections and gate intake drawers (parking, breakfasts, bingo and the like).
•	flag_charity_proposals (BIT, NOT NULL, DEFAULT 1) — Sprint 6A patch feature flag: 0 hides Propose Charity Grant (the member grant form and its progress tracking) and the Charity Vetting Queue. The charities registry and the charitable disbursements ledger stay with the financial engine.
•	flag_complex_shifts (BIT, NOT NULL, DEFAULT 1) — Sprint 6A feature flag: 0 hides the event planner, the shift tabs of Member Actions, shift hour reports, and the phone app Signup tab and My shifts list. Activity hours stay.
•	flag_meeting_management (BIT, NOT NULL, DEFAULT 1) — Sprint 6A feature flag: 0 hides the meeting center, cadence manager and live console, and the phone app Mtgs tab. Only an Active Super Admin changes any flag (councils.setFeatureFlags, from the Councils page); councils.create and update never touch them. Hidden data stays and returns when the flag is set back to 1.
[AffiliatedCouncils]
Many-to-many relationship mapping shared data permissions between distinct councils.
•	PrimaryCouncilID (INTEGER, NOT NULL) — Composite Primary Key / Foreign Key references Council(id).
•	AffiliatedCouncilID (INTEGER, NOT NULL) — Composite Primary Key / Foreign Key references Council(id).
[Parish]
Physical church venues associated with one anchoring council.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	Name (VARCHAR(100), NOT NULL) — Church parish title text.
•	StreetAddress1 (VARCHAR(255), NOT NULL) — Main physical delivery address line.
•	StreetAddress2 (VARCHAR(255), NULL) — Optional secondary unit or suite string.
•	City (VARCHAR(50), NOT NULL) — Municipality localization.
•	State (VARCHAR(50), NOT NULL) — State region parameter.
•	Phone (VARCHAR(50), NULL) — Primary rectory contact line.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
[Pastor]
Clergy records tied to individual church venues.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	FirstName (VARCHAR(50), NOT NULL) — Given name.
•	LastName (VARCHAR(50), NOT NULL) — Surname.
•	Phone (VARCHAR(50), NULL) — Direct contact telephone link.
•	Email (VARCHAR(50), NULL) — Direct communication email target.
•	ParishID (INTEGER, NOT NULL) — Foreign Key references Parish(id).
[Meeting]
Scheduled fraternal gatherings managed by Council Officers or Administrators.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NULL) — Foreign Key references Council(id). Identifies host branch.
•	Meeting Name (VARCHAR(100), NULL) — Core title banner text.
•	Meeting Description (VARCHAR(255), NULL) — Overview or purpose parameters.
•	Date (DATE, NULL) — Calendar date step.
•	Time Start (TIME, NULL) — Clock trigger step for meeting commencement.
•	Time End (TIME, NULL) — Clock completion tracking metric.
•	Location (VARCHAR(100), NULL) — Physical church hall or virtual meeting link coordinate.
•	Agenda (TEXT, NULL) — Unbounded text block detailing topics for review.
•	MinutesURL (VARCHAR(255), NULL) — Storage link to uploaded administrative PDF files.
•	MeetingType (INTEGER, NULL) — Foreign Key references MeetingType(id).
•	GoogleDriveMinutesURL (VARCHAR(2000), NULL) — Shared Google Drive link to the meeting minutes (https on drive.google.com or docs.google.com). Set only through meetings.linkGoogleDrive by the meeting's owner, the council's Admins, Financial Secretary or Treasurer, or a Super Admin.
•	GoogleDriveFlyerURL (VARCHAR(2000), NULL) — Shared Google Drive link to the meeting flyer, with the same rules as GoogleDriveMinutesURL.
•	OwnerID (INTEGER, NULL) — Foreign Key references Member(id). The member who runs the meeting; they manage its attendance, minutes and Google Drive links alongside the council's Admins and Super Admins.
•	IsMultiDay (BIT, NOT NULL, DEFAULT 0) — Sprint 5Y-5: the meeting spans more than one day. Sprint 5Y-6: such a meeting (a Multi-Day Assembly) runs from Date through EndDate as whole days with no clock times; its Time Start and Time End are stored as 00:00:00, so it counts no meeting hours (cleanMeetingSpan).
•	MeetingTypeID (INTEGER, NULL) — Sprint 5Y-5: Foreign Key references CouncilMeetingType(id). The council's own meeting type; NULL while the meeting is not filed under one. MeetingType above still points at the global MeetingType lookup; the schedule form files the meeting under the global type of the same name, or the first one. It must be one of the meeting's own council's types (INVALID_INPUT).
•	EndDate (DATE, NULL) — Sprint 5Y-6: the last day of a multi-day meeting, after its Date; NULL for a one-day meeting, which may not carry one (INVALID_INPUT). The calendar spans a multi-day meeting across its days, all day, and lists it as upcoming until its EndDate has passed.
•	MissionAreaID (INTEGER, NULL) — Sprint 5Z-1: Foreign Key references CouncilMissionArea(id). The council mission area (Faith, Family, Community, Life) the meeting is filed under; NULL while unfiled.
•	InviteReleaseDate (DATE, NULL) — Sprint 5Z-6 drip release: the day the meeting's invitations reach members' own feeds. Until then the meeting is on the master calendar and its invitation rows exist (its managers see them), but meetings.listUpcoming for a member, listSchedules and rsvpToInvite ignore them (rsvpToInvite rejects NOT_INVITED). NULL means released at once, as for every hand-scheduled meeting. meetings.populateAnnualCadence sets it 5 calendar days before Date (CADENCE_INVITE_LEAD_DAYS). Appended by ALTER TABLE (schema version 25).
•	ActiveAgendaItemName (VARCHAR(255), NULL) — Sprint 5Z-9 live console: the agenda topic on the center bar (meetings.advanceActiveAgendaItem); cleared when the console closes. Appended by ALTER TABLE (schema version 28).
•	ActiveAgendaItemTimeRemaining (INTEGER, NULL) — Sprint 5Z-9: the minutes allotted to the active item when it was pushed (1 to 240, LIVE_AGENDA_ITEM_MAX_MINUTES). The seconds left are worked out from ActiveAgendaItemStartedAt when the state is read (meetings.getLiveAssemblyState), so every phone shows the same countdown.
•	IsLiveInProgress (BIT, NOT NULL, DEFAULT 0) — Sprint 5Z-9: the meeting is being run live (meetings.startLiveAssemblyConsole sets it; closeLiveAssemblyConsole clears it, refused while a ballot is open). Check-ins, agenda items and ballots need it.
•	ActiveAgendaItemStartedAt (DATETIME, NULL) — Sprint 5Z-9, added beyond the step's column list: when the active item began ('YYYY-MM-DD HH:MM:SS' UTC), the shared clock the countdown runs from.
•	LiveQuorumRosterCount (INTEGER, NULL) — Sprint 5Z-9, added beyond the step's column list: the council's Active roster count locked when the console first went live, the base for the quorum check. Kept after the console closes as the meeting's record.
[MeetingInvites]
Tracks meeting rosters, invitations, and recorded user attendance.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	MeetingID (INTEGER, NULL) — Foreign Key references Meeting(id).
•	MemberID (INTEGER, NULL) — Foreign Key references Member(id).
•	Attended (BIT, DEFAULT 0) — Attendance flag (1 = Present, 0 = Absent/No-Show).
•	ResponseStatus (VARCHAR(50), NOT NULL, DEFAULT 'NoResponse') — Sprint 5Y-5: the invitee's RSVP: NoResponse, Accepted or Declined (MEETING_RESPONSE_STATUSES, enforced by the shared rules layer). Set only by meetings.rsvpToInvite, where a member answers their own invitation (NOT_INVITED when they have none).
[CouncilMeetingType]
Sprint 5Y-5: a meeting type a council defines for itself, read through meetings.listCouncilMeetingTypes (ordered by name). Seed.sql gives Council 15295 the standard Monthly, Officer and Community types; every other council defines its own. A council cannot be deleted while it has meeting types (RECORD_IN_USE).
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
•	TypeName (VARCHAR(100), NOT NULL) — The type's name. Unique per council (a unique index on CouncilID, TypeName), so councils never share or see each other's types.
[CouncilAgendaTemplate]
Sprint 5Y-5: a council's agenda outline for one of its meeting types, read through meetings.getAgendaTemplate (null when the council has none for that type). Sprint 5Y-6: written through meetings.saveAgendaTemplate (Council Lookups, Meeting Agenda Templates tab) by an Active Admin or Grand Knight of the council, or an Active Super Admin (assertMayManageAgendaTemplates); saving blank text removes it. The Meeting center's schedule form fills its agenda from the template of the meeting type chosen. A council cannot be deleted while it has agenda templates (RECORD_IN_USE).
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
•	MeetingTypeID (INTEGER, NOT NULL) — Foreign Key references CouncilMeetingType(id).
•	TemplateText (TEXT, NOT NULL) — The agenda outline, at most 10,000 characters (AGENDA_TEMPLATE_MAX_LENGTH). One template per council and type (a unique index on CouncilID, MeetingTypeID).

________________________________________
# 3. Members & Relationships
[Member]
The master roster directory storing personal and membership data.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
•	MemberNumber (INTEGER, NOT NULL) — Supreme Council official member registration number.
•	MemberFirstName (VARCHAR(100), NOT NULL) — Given name.
•	MemberLastName (VARCHAR(100), NOT NULL) — Surname.
•	Phone (VARCHAR(50), NOT NULL) — Primary contact telephone string.
•	StreetAddress1 (VARCHAR(255), NOT NULL) — Primary residential delivery line.
•	StreetAddress2 (VARCHAR(255), NULL) — Optional secondary residential string.
•	City (VARCHAR(50), NOT NULL) — Local home city.
•	State (VARCHAR(20), NOT NULL) — Home state region code.
•	ZipCode (VARCHAR(15), NOT NULL) — Postal tracking index.
•	Email (VARCHAR(50), NOT NULL) — Target contact address (used for onboarding validation lookup).
•	DateOfBirth (DATE, NOT NULL) — Birthday timestamp profile record.
•	StatusID (INTEGER, NOT NULL) — Foreign Key references MemberStatus(id).
•	DegreeID (INTEGER, NOT NULL) — Foreign Key references Degree(id).
•	MemberTypeID (INTEGER, NOT NULL) — Foreign Key references MemberType(id).
•	CredentialID (INTEGER, NOT NULL) — Foreign Key references Credentials(id).
•	ProfilePhotoURL (VARCHAR(2000), NULL) — The member's avatar photo, set on My Profile (Sprint 5S). A local file path (browser blob or phone file://) until a file store exists.
•	Biography (TEXT, NULL) — A short personal fraternal biography the member writes on My Profile, at most 2,000 characters (Sprint 5S).
•	ExpoPushToken (VARCHAR(512), NULL) — The member's phone push address (ExponentPushToken[...]), set by notifications.registerDeviceToken (Sprint 5T). A device credential: member reads never return it, and a token moves to whichever member registered the phone last.
•	IsBudgetDirector (BIT, NOT NULL, DEFAULT 0) — Sprint 5Y-3: the member is the council's Designated Budget Director and may prepare its annual budget alongside its Admins, Financial Secretary and Treasurer. Set only by an Admin of the member's council or a Super Admin (members.update); a member cannot set it on their own record.
[MemberRoles]
Bridge table enabling members to hold multiple concurrent roles or chairmanships.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	RoleID (INTEGER, NOT NULL) — Foreign Key references Role(id).
•	MemberID (INTEGER, NOT NULL) — Foreign Key references Member(id).
[MemberTraining]
The intersection table linking individual members to completed training modules, including a tracking constraint for year validation.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing relational identifier.
•	MemberID (INTEGER, NOT NULL) — Foreign Key references Member(id). Specifies which person completed the training assignment.
•	TrainingClassID (INTEGER, NOT NULL) — Foreign Key references KOCTrainingClasses(id). Links to the specific class definition.
•	YearTaken (DATE, NOT NULL) — Calendar date step indicating when the class was completed. Validated by system test constraints to block entries prior to 1882 or after the current calendar year.
[MemberSkill]
The many-to-many intersection entity bridging individual council members to their specific trades and corresponding expertise levels.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing relational identifier.
•	SkillID (INTEGER, NOT NULL) — Foreign Key references Skill(id). Ties row to a specific trade descriptor.
•	SkillLevelID (INTEGER, NOT NULL) — Foreign Key references SkillLevel(id). Establishes the experience classification.
•	MemberID (INTEGER, NOT NULL) — Foreign Key references Member(id). Binds the skill listing directly to a specific brother on the roster.

________________________________________
# 4. Events, Shifts, & Transactional Metrics
[Event]
Multi-day calendar activities managed by councils.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	EventName (VARCHAR(100), NOT NULL) — Title heading text.
•	EventDescription (VARCHAR(255), NOT NULL) — Informational summary block.
•	OwnerID (INTEGER, NOT NULL) — Foreign Key references Member(id) (Appoints Event Chairman).
•	StartDate (DATE, NOT NULL) — Operational launch target date boundary.
•	EndDate (DATE, NOT NULL) — Operational final tracking date boundary.
•	Location (VARCHAR(255), NOT NULL) — Venue coordinate or layout definition.
•	CategoryID (INTEGER, NOT NULL) — Foreign Key references Category(id).
•	Budget (MONEY, NULL) — Planned administrative expense ceiling allocation.
•	Spend (MONEY, NULL) — Post-mortem actual dollar expenditure metric.
•	FundsRaised (MONEY, NULL) — Total event revenue/donations accrued. Stored as FundsRaised-Cash and FundsRaised-Electronic; once the event has any cash or electronic Donation rows, the data service keeps both as read-only sums of those rows (physical items excluded), otherwise they are entered by hand.
•	Highlights (TEXT, NULL) — Unbounded notes block detailing achievements.
•	PlannedNumberAttendees (INTEGER, NULL) — Initial attendance estimate.
•	ActualNumberAttendees (INTEGER, NULL) — Verified post-event foot-traffic count.
•	PhotoGalleryURL (VARCHAR(2000), NULL) — Comma-separated local photo reference paths, appended to (never overwritten) through events.uploadPhotos by the event's owner, an Admin, Financial Secretary or Treasurer of a linked council, or a Super Admin.
•	IsAnnual (BIT, NOT NULL, DEFAULT 0) — Sprint 5Y: the event recurs every fraternal year. budget.prePopulateNextYear gives each annual event of the council a budget line; a copied (twin) annual event stays annual.
•	IsMultiDay (BIT, NOT NULL, DEFAULT 0) — Sprint 5Y-5: the event spans more than one day. Sprint 5Y-6: set by the event form's Multi-Day Assembly / Extended Event box through events.create and events.update; unticked, the form ends the event the day it starts. A copied (twin) multi-day event stays multi-day.
•	MissionAreaID (INTEGER, NULL) — Sprint 5Z-1: Foreign Key references CouncilMissionArea(id). The council mission area (Faith, Family, Community, Life) the event is filed under; NULL while unfiled.
•	IntakeSessionStatus (VARCHAR(50), NOT NULL, DEFAULT 'Inactive') — Sprint 5Z-7: Inactive or Active (EVENT_INTAKE_SESSION_STATUSES; rules layer, no CHECK). Gates the phone's high-speed intake screens for the event. Appended by ALTER TABLE (schema version 26).
[EventCouncils]
Bridge table mapping event participation and cross-visibility among affiliated councils.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	EventID (INTEGER, NOT NULL) — Foreign Key references Event(id).
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
[Shift]
Granular operational work blocks under an overarching parent event.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	ShiftName (VARCHAR(100), NOT NULL) — Task title designation (e.g., 'Morning Setup Shift').
•	ShiftDescription (VARCHAR(255), NOT NULL) — Detailed assignment role parameters.
•	ShiftDate (DATE, NOT NULL) — Calendar assignment date.
•	StartTime (TIME, NOT NULL) — Daily operational kick-off time step.
•	EndTime (TIME, NOT NULL) — Daily operational wrapping time step.
•	EventID (INTEGER, NOT NULL) — Foreign Key references Event(id).
•	MinNumberVolunteers (INTEGER, NOT NULL) — Required recruitment target ceiling.
•	NumberVolunteersSignedUp (INTEGER, NOT NULL) — Running aggregate enrollment counter.
[EventSignup]
Tracks shift schedules, user availability, and attendance logs.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	ShiftID (INTEGER, NOT NULL) — Foreign Key references Shift(id).
•	MemberID (INTEGER, NOT NULL) — Foreign Key references Member(id).
•	NoShow (BIT, NOT NULL, DEFAULT 0) — Flag toggled if user fails to arrive (1 = Missed, 0 = Attended).
•	NoShowReasonID (INTEGER, NULL) — Foreign Key references NoShowReason(id) (populated only if NoShow = 1).
•	SignupNotes (VARCHAR(255), NULL) — Personal remarks block or special accomodations notes.
[EventTime]
Aggregated records of volunteer time spent on event shifts.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	ShiftID (INTEGER, NOT NULL) — Foreign Key references Shift(id).
•	MemberID (INTEGER, NOT NULL) — Foreign Key references Member(id).
•	Hours (DECIMAL(5,2), NOT NULL) — Total volunteer hours logged (restricted to 15-minute increments).
•	ShiftNotes (VARCHAR(255), NULL) — Task log field or performance recap notes.
[LessonsLearned]
The post-event institutional knowledge base repository.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	EventID (INTEGER, NOT NULL) — Foreign Key references Event(id).
•	LeassonsLearnedCategoryID (INTEGER, NOT NULL) — Foreign Key references LessonsLearnedCategory(id).
•	LessonsLearnedDescription (VARCHAR(255), NOT NULL) — Explicit summary breakdown of what went well or needs fixing.
________________________________________
[Donation]
Transactional financial records tracking standalone or event-linked receipts.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
•	DonationDate (DATE, NOT NULL) — Calendar date the payment occurred.
•	DonationMethodID (INTEGER, NOT NULL) — Foreign Key references DonationMethod(id).
•	DonationTypeID (INTEGER, NOT NULL) — Foreign Key references DonationType(id).
•	Donor (VARCHAR(100), NULL) — Optional field recording the donor's name.
•	DonationDescription (VARCHAR(255), NULL) — Structural description notes.
•	EventID (INTEGER, NOT NULL) — Foreign Key references Event(id).
•	DonationAmount (MONEY, NOT NULL) — Dollar scale precision total entry.
•	DonationPhotoURL (VARCHAR(255), NULL) — Storage bucket link for physical item verification images.
•	RecordedBy (INTEGER, NULL) — Foreign Key references Member(id). The member who recorded the donation, stamped once when it is recorded and never changed; that member and the event's owner may correct or delete the row alongside council Admins and Super Admins.
# 5. Unscheduled Council Activities
[Activities]
Ongoing, non-scheduled initiatives localized to single councils.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	ActivityName (VARCHAR(100), NOT NULL) — Continuous initiative title (e.g., 'Garbage Collection').
•	ActivityDescription (VARCHAR(255), NOT NULL) — Statement outlining task objectives.
•	CategoryID (INTEGER, NOT NULL) — Foreign Key references Category(id).
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
[ActivityTime]
Volunteer time records logged directly against open activities without signup constraints.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	MemberID (INTEGER, NOT NULL) — Foreign Key references Member(id).
•	ActivityID (INTEGER, NOT NULL) — Foreign Key references Activities(id).
•	ActivityDate (DATE, NOT NULL) — Calendar date when work occurred.
•	Hours (DECIMAL(5,2), NOT NULL) — Total volume of recorded effort (restricted to 15-minute steps).
•	ActivityNotes (VARCHAR(255), NULL) — Operational remarks summary detailing work completed.
________________________________________
# 6. Asynchronous Messaging Infrastructure
[DistributionLists]
Custom recipient groups. Since Sprint 5Z-10.8 a list is council-wide (assembled by the council's Admins or a Super Admin for bulk communication, seen by every member) or private (any Active member's own segment of fellow members of their council, seen, changed and deleted by its creator alone; another member, Admins included, gets RECORD_NOT_FOUND). distributionLists.listForMember returns the council-wide lists and the caller's own private ones; listByCouncil only the council-wide lists. Names are unique ignoring case among the council's council-wide lists, and among each member's private lists.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	ListName (VARCHAR(100), NULL) — Group reference name (e.g., 'Officers Distribution List').
•	CouncilID (INTEGER, NULL) — Foreign Key references Council(id).
•	CreatedBy (INTEGER, NULL) — Foreign Key references Member(id) (Tracks list author).
•	CreatedAt (DATETIME, DEFAULT GETDATE()) — Initialization creation timestamp.
•	IsCouncilWide (BIT, NOT NULL, DEFAULT 1) — Sprint 5Z-10.8: 1 for a council-wide list, 0 for a private one. distributionLists.create makes a private list unless IsCouncilWide is asked for, which needs Admin rights in the council (assertMayCreateDistributionList); lists made before this column were all Admins' and stay council-wide. Only the creator may take a council-wide list private, and publishing a private list needs Admin rights too (assertMayChangeDistributionList). Appended by ALTER TABLE (schema version 29).
[DistributionListMembers]
Many-to-many relationship mapping members into target distribution lists.
•	ListID (INTEGER, NOT NULL) — Composite Primary Key / Foreign Key references DistributionLists(id).
•	MemberID (INTEGER, NOT NULL) — Composite Primary Key / Foreign Key references Member(id).
[ChatThreads]
Communication routing containers used to structure messaging groups or direct message channels.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NULL) — Foreign Key references Council(id) (NULL indicates cross-council routing).
•	IsGroupChat (BIT, DEFAULT 0) — Context flag (1 = Multi-user/Blast, 0 = 1:1 Direct Message).
•	CreatedAt (DATETIME, DEFAULT GETDATE()) — Thread creation baseline time tracking marker.
[Messages]
Individual message contents sent within a specific thread.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	ThreadID (INTEGER, NULL) — Foreign Key references ChatThreads(id).
•	SenderID (INTEGER, NULL) — Foreign Key references Member(id).
•	ParentMessageID (INTEGER, NULL) — Self-Referencing Foreign Key references Messages(id) (Enables nested conversational threads).
•	MessageText (TEXT, NULL) — The raw message text payload.
•	IsDraft (BIT, DEFAULT 0) — Draft flag (1 = Local un-sent workspace draft, 0 = Published message).
•	CreatedAt (DATETIME, DEFAULT GETDATE()) — Outgoing transmission timestamp record.
[MessageAttachments]
Tracks files or images attached to messages, utilizing a hybrid storage URL strategy.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	MessageID (INTEGER, NOT NULL) — Foreign Key references Messages(id).
•	Filename (VARCHAR(255), NOT NULL) — Original upload file name string (e.g., 'financial_report.xlsx').
•	FileType (VARCHAR(100), NOT NULL) — Standard MIME asset type classification (e.g., 'application/pdf').
•	StorageURL (VARCHAR(512), NOT NULL) — Local temporary route file reference or production Azure Blob Storage URL string.
•	UploadedAt (DATETIME, DEFAULT GETDATE()) — File intake upload confirmation timestamp.
[ReadReceipts]
Tracks delivery confirmation status, read markers, and administrator action follow-up flags.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	MessageID (INTEGER, NULL) — Foreign Key references Messages(id).
•	MemberID (INTEGER, NULL) — Foreign Key references Member(id).
•	ReadAt (DATETIME, NULL) — Read timestamp (NULL signifies unread or explicitly marked as unread status).
•	IsFlagged (BIT, DEFAULT 0) — Follow-up indicator (1 = Flagged for later review action, 0 = Standard history archive).
________________________________________

# 7. Expense Reporting (Sprint 5R)
[ExpenseDisbursement]
One check that pays one or more approved expense reports of a council, each carrying both dual-approval signatures (Sprint 5Z-4). Recorded only by the council's Financial Secretary or Treasurer, or a Super Admin (expenses.recordDisbursement).
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id). The paying council.
•	CheckNumber (VARCHAR(50), NOT NULL) — The check's number; unique within the council (ignoring case).
•	PayoutDate (DATE, NOT NULL) — The date on the check.
•	TotalAmount (DECIMAL(18,2), NOT NULL) — The paid reports' line items in total, computed by the service, never entered.
•	Notes (TEXT, NULL) — Optional memo; at most 2,000 characters.
[ExpenseReport]
A member's expense sheet. Members see only their own; the council's Admins, Financial Secretary and Treasurer and any Super Admin review the council's queue.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id). Always the submitter's own council.
•	SubmitterMemberID (INTEGER, NOT NULL) — Foreign Key references Member(id). The member to reimburse.
•	Status (VARCHAR(50), NOT NULL) — Draft, Submitted, Approved or Reimbursed. Only drafts may be edited; leadership returns Submitted sheets to Draft with a reason. A Submitted sheet reaches Approved only through dual approval (Sprint 5Z-3; the single-step expenses.approveReport was retired in Sprint 5Z-4): the Financial Secretary's written order (expenses.financialSecretaryAuditOrder), then the Grand Knight's counter-signature (expenses.grandKnightAuthorizeOrder), which sets Approved. Nobody signs their own sheet, whatever their role. The finance officers pay Approved sheets that carry both signatures; a sheet missing either is never paid (expenses.recordDisbursement, EXPENSE_STATUS_CONFLICT). Approved and Reimbursed line items count toward the monthly summary's spend.
•	LinkedEventID (INTEGER, NULL) — Foreign Key references Event(id). An event linked to the report's council. Sprint 5Z-5 submission window: a sheet linked to an event can be submitted only from the event's StartDate (earlier rejects EXPENSE_WINDOW_NOT_OPEN) through 30 days after its EndDate (EXPENSE_SUBMISSION_GRACE_DAYS; later rejects EXPENSE_WINDOW_CLOSED), both inclusive, by the local calendar date. Drafts may be saved at any time; sheets linking neither an event nor a meeting are not limited.
•	LinkedMeetingID (INTEGER, NULL) — Foreign Key references Meeting(id). A meeting of the report's council. Sprint 5Z-6: held to the same submission window as an event, from the meeting's Date through 30 days after its last day (EndDate for a multi-day meeting). A sheet naming both must be inside both windows. The web and phone expense forms padlock the submit button outside the window, and the phone's Report Hours screen padlocks shifts whose event is outside it (screen only; the data service's hours rules are unchanged).
•	DisbursementID (INTEGER, NULL) — Foreign Key references ExpenseDisbursement(id). The check that paid it; set with Status Reimbursed.
•	RejectionReason (VARCHAR(2000), NULL) — Why leadership returned the sheet to Draft (expenses.rejectReport); kept while it is a draft, cleared when it is submitted again.
•	FinancialSecretaryMemberID (INTEGER, NULL) — Sprint 5Z-3: Foreign Key references Member(id). The Financial Secretary (or Super Admin) who audited the Submitted sheet and issued its written order; never the submitter. Cleared when the sheet is returned to Draft.
•	FinancialSecretaryApprovedAt (DATETIME, NULL) — Sprint 5Z-3: when the written order was issued. Set and cleared with FinancialSecretaryMemberID.
•	GrandKnightMemberID (INTEGER, NULL) — Sprint 5Z-3: Foreign Key references Member(id). The Grand Knight (or Super Admin) who counter-signed the order, releasing the sheet to the Treasurer with Status Approved. Requires the written order first, and must be neither the submitter nor the officer who issued the order. Cleared when the sheet is returned to Draft.
•	GrandKnightApprovedAt (DATETIME, NULL) — Sprint 5Z-3: when the Grand Knight counter-signed. Set and cleared with GrandKnightMemberID.
The four dual-approval columns are appended by explicit ALTER TABLE ... ADD statements (schema version 23). Seed.sql's presentation data signs every reimbursed sheet (member 2 the order, member 1 the counter-signature) and adds three in the pipeline: #11 awaiting the written order, #12 awaiting the counter-signature and #13 dual-signed, awaiting a check.
[ExpenseLineItem]
One receipt on an expense report. A draft's line items are replaced as a whole each time it is saved.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	ExpenseReportID (INTEGER, NOT NULL) — Foreign Key references ExpenseReport(id).
•	DateOfExpense (DATE, NOT NULL) — When the money was spent; never in the future.
•	Amount (DECIMAL(18,2), NOT NULL) — More than 0, in whole cents.
•	VendorName (VARCHAR(255), NOT NULL) — Who was paid.
•	ReceiptPhotoURL (VARCHAR(2000), NULL) — Local or storage path of the receipt photo.
•	ExpenseDescription (TEXT, NOT NULL) — What was bought and why; at most 2,000 characters.
________________________________________

# 8. Push Notifications and Supreme Council Reporting (Sprint 5T)
[NotificationLog]
One alert as sent to one member. Written by notifications.dispatchHighPriorityAlert, which only the council's Admins, Financial Secretary and Treasurer and any Super Admin may call; every member reads their own alerts of the trailing six months.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id). The council whose leadership sent the alert.
•	TargetMemberID (INTEGER, NOT NULL) — Foreign Key references Member(id). The recipient, an Active member of that council.
•	Title (VARCHAR(100), NOT NULL) — The alert's headline.
•	MessageBody (VARCHAR(2000), NOT NULL) — The alert's text.
•	Priority (VARCHAR(10), NOT NULL) — Low, Medium or High (the default); maps to Expo's normal, default and high push priority.
•	SentAt (DATETIME, NOT NULL, DEFAULT getdate()) — When the alert was sent (UTC). DATETIME rather than TIMESTAMP, which in T-SQL is a ROWVERSION counter.
•	IsRead (BIT, NOT NULL, DEFAULT 0) — Whether the member has opened the alert.
[SupremeReportingSync]
One push of a council's compliance answers to an Alchemer survey (supreme.syncAlchemerReport), successful or not. Same leadership rule as NotificationLog.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
•	FormType (VARCHAR(20), NOT NULL) — AnnualSurvey (Form 1728, the previous calendar year) or CouncilAudit (Form 1295, the previous half-year).
•	SyncDate (DATETIME, NOT NULL, DEFAULT getdate()) — When the sync ran (UTC).
•	SyncedByID (INTEGER, NOT NULL) — Foreign Key references Member(id). The officer who ran it.
•	AlchemerSurveyID (VARCHAR(100), NOT NULL) — The numeric Alchemer survey id the response was filed to.
•	Status (VARCHAR(10), NOT NULL) — Success, or Failed when the Alchemer post threw or was refused.
________________________________________

# 9. Officer Elections and Leadership History (Sprint 5U)
Offices are matched by Role name in the shared rules (Grand Knight, Deputy Grand Knight, Trustee 1-3 and the appointed offices), never by id. A seat's holder is whoever holds the role in MemberRoles; these tables record the ballot and the terms. The fraternal year runs July 1 to June 30 and is written '2026-2027'.
[CouncilElectionBallot]
Whether one of a council's elected seats is open for nomination this cycle. Opened and closed by the council's Admins or a Super Admin (elections.toggleRoleBallotStatus); an abdication from an elected seat opens a mid-year election.
•	CouncilID (INTEGER, NOT NULL) — Composite Primary Key; Foreign Key references Council(id).
•	RoleID (INTEGER, NOT NULL) — Composite Primary Key; Foreign Key references Role(id). An elected office.
•	IsUpForElection (BIT, NOT NULL, DEFAULT 0) — 1 while the seat takes nominations.
•	IsMidYearElection (BIT, NOT NULL, DEFAULT 0) — 1 when an abdication opened the seat mid-term.
•	NominationsCloseAt (DATETIME, NULL) — Mid-year elections only: two weeks after the abdication (UTC).
[OfficerNominations]
One member put up for one seat in one term (elections.submitNomination), by any Active member of the council or a Super Admin.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
•	OfficeRoleID (INTEGER, NOT NULL) — Foreign Key references Role(id). The elected seat.
•	NomineeMemberID (INTEGER, NOT NULL) — Foreign Key references Member(id). An Active member of the council.
•	NominatedByMemberID (INTEGER, NOT NULL) — Foreign Key references Member(id).
•	NominatedAt (DATETIME, NOT NULL, DEFAULT getdate()) — When the nomination was made (UTC).
•	FraternalYear (VARCHAR(9), NOT NULL) — The term the election fills, e.g. '2027-2028'. Unique together with CouncilID, OfficeRoleID and NomineeMemberID.
•	IsEligible (BIT, NOT NULL, DEFAULT 1) — 0 for a Grand Knight nominee who has never served as Deputy Grand Knight or Grand Knight; the nomination still counts.
[CouncilLeadershipHistory]
One member's time in one seat. A NULL EndDate marks the sitting holder.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
•	MemberID (INTEGER, NOT NULL) — Foreign Key references Member(id).
•	RoleID (INTEGER, NOT NULL) — Foreign Key references Role(id).
•	FraternalYear (VARCHAR(9), NOT NULL) — The term, e.g. '2026-2027'.
•	StartDate (DATE, NOT NULL) — When the member took the seat.
•	EndDate (DATE, NULL) — When the member left it; NULL while they hold it.
•	ExitReason (VARCHAR(50), NULL) — TermConcluded or Abdicated.
•	AppointedByID (INTEGER, NULL) — Foreign Key references Member(id). The Grand Knight or Super Admin who appointed the member; NULL when elected or backfilled.
________________________________________

# 10. Charitable Giving and Disbursements (Sprint 5V)
[GlobalCharityRegistry]
One charity in the registry every council shares. Any member may search it; only an Active Admin or Super Admin adds entries directly (charities.addGlobalCharity), and a Financial Secretary or Treasurer registers one while paying it (charities.hydrateAndDisburse). A charity is a duplicate of an entry with the same EIN or, when either EIN is missing, the same Name and State ignoring case; duplicates are refused with CHARITY_ALREADY_REGISTERED.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	Name (VARCHAR(255), NOT NULL) — The charity's name.
•	Description (TEXT, NOT NULL) — What the charity does; at most 2,000 characters.
•	EIN (VARCHAR(20), NULL) — IRS Employer Identification Number, stored as NN-NNNNNNN. Unique when present (a filtered unique index skips NULLs).
•	State (VARCHAR(2), NOT NULL) — Two-letter postal code, upper case; drives charities.listSuggestedLocal.
•	Phone (VARCHAR(50), NULL) — The charity's phone number.
•	ContactName (VARCHAR(255), NULL) — The charity's contact person.
•	ContactEmail (VARCHAR(255), NULL) — The contact's email address.
•	Address (VARCHAR(512), NULL) — Mailing address, where checks are sent.
•	ZipCode (VARCHAR(20), NULL) — Mailing ZIP code.
•	IsCatholic (BIT, NOT NULL, DEFAULT 0) — Whether the charity is a Catholic ministry; Catholic charities are suggested first.
•	CharityType (VARCHAR(100), NOT NULL) — The charity's cause, one of the six core types (Sprint 5V-2): Food Security, Women and Children, Faith, Protecting Life, Homelessness or Parish.
•	IsAnnual (BIT, NOT NULL, DEFAULT 0) — Sprint 5Y: councils give to the charity every fraternal year. budget.prePopulateNextYear gives each annual charity a council paid last year a Donation budget line.
[CouncilCharityLink]
A council's connection to a registry charity. Made by council leadership (charities.connectCouncilToCharity) or automatically when a charity check is paid.
•	CouncilID (INTEGER, NOT NULL) — Composite Primary Key; Foreign Key references Council(id).
•	CharityID (INTEGER, NOT NULL) — Composite Primary Key; Foreign Key references GlobalCharityRegistry(id).
•	ConnectedAt (DATETIME, NOT NULL, DEFAULT getdate()) — When the council connected to the charity (UTC).
[CharityDonationProposal]
A member's proposal that the council give to a charity (charities.proposeDonation), open to every Active member of the council.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
•	SubmitterMemberID (INTEGER, NOT NULL) — Foreign Key references Member(id). The member who proposed the gift.
•	ProposedCharityName (VARCHAR(255), NOT NULL) — The charity as the member named it; the registry entry's Name when the member picked one.
•	ProposedAmount (DECIMAL(18,2), NOT NULL) — The proposed gift, more than 0.
•	ExistingCharityID (INTEGER, NULL) — Foreign Key references GlobalCharityRegistry(id). Set when the member picks a registry entry, or when a finance officer pays the proposal.
•	Status (VARCHAR(50), NOT NULL) — Pending, Approved (paid by hydrateAndDisburse) or Rejected (by council leadership, charities.rejectProposal).
•	MeetingMinutesID (INTEGER, NULL) — Foreign Key references Meeting(id). The council meeting whose minutes record the vote.
•	RejectionReason (VARCHAR(2000), NULL) — Why leadership rejected the proposal (Sprint 5V-2); set only when Status is Rejected.
[CharitableDisbursementLedger]
One check a council paid to a charity, written by charities.hydrateAndDisburse (the council's Active Financial Secretary or Treasurer, or an Active Super Admin). reports.monthlySummary counts it as charitable giving, and so as spend, in the month of its PayoutDate.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
•	CharityID (INTEGER, NOT NULL) — Foreign Key references GlobalCharityRegistry(id).
•	Amount (DECIMAL(18,2), NOT NULL) — The check amount, more than 0; the proposal's amount unless the council voted another.
•	CheckNumber (VARCHAR(50), NOT NULL) — Unique per council across this ledger and ExpenseDisbursement: one checkbook pays both.
•	DisbursedByID (INTEGER, NOT NULL) — Foreign Key references Member(id). The officer who issued the check.
•	PayoutDate (DATE, NOT NULL) — The date on the check.
•	Notes (TEXT, NULL) — Optional memo; at most 2,000 characters.
•	ProposalID (INTEGER, NULL) — Foreign Key references CharityDonationProposal(id). The proposal the check paid (Sprint 5V-2), for the audit trail.
________________________________________

# 11. Annual Budget Forecasting (Sprint 5Y)
[CouncilBudgetForecast]
One line of a council's budget for one fraternal year (July 1 - June 30). Every Active member of the council may read it (Sprint 5Y-3 transparency; assertMayViewBudgetForecast), and an Active Super Admin any council's. Only council leadership - an Active Admin, Financial Secretary or Treasurer of the council, or its Designated Budget Director (Member.IsBudgetDirector) - or an Active Super Admin may change it (assertMayManageBudgetForecast). A year is prepared from May 1 (00:00) through June 30 (midnight), local time, and locks as Finalized on July 1 (Sprint 5Y-3.5). Outside that window every write (budget.updateLineItemBudget, budget.addCustomBudgetLine, budget.prePopulateNextYear) is refused: before May 1 with BUDGET_WINDOW_NOT_OPEN, from July 1 with BUDGET_YEAR_FINALIZED, unless an Active Super Admin passes superAdminOverride. Every read and write is scoped to one council. budget.prePopulateNextYear seeds a year from the previous year's actual spend, counted as in reports.monthlySummary (an event's Spend plus the line items of the council's Approved and Reimbursed expense sheets, and the council's charity checks), carries the previous year's custom lines forward at a baseline of their ApprovedBudgetAmount, last year's approved cap (Sprint 5Y-6.5; 0 when that year was never approved), and can be re-run: existing lines only have PrePopulatedAmount refreshed. budget.getPriorYearBaselines (Sprint 5Y-6.5, read by whoever may read the budget) sets last year's approved cap for the line each one continues beside last year's whole-year actual spend charged to it, for the Annual Budget Projections' dual-baseline columns. Custom lines come from budget.addCustomBudgetLine.
Sprint 5Y-4 lifecycle: every figure leadership drafts is a ProposedBudgetAmount, and the line's BudgetStatus moves from Draft (seeded, nothing proposed) to Proposed. ApprovedBudgetAmount stays 0.00 until budget.approveAndFinalizeEntireBudget records the council's vote: in one transaction every line of the year takes ApprovedBudgetAmount = ProposedBudgetAmount and BudgetStatus Approved. Only an Active Admin, Financial Secretary or Treasurer of the council, or an Active Super Admin, may approve (assertMayApproveBudget; not the Budget Director), from the year's May 1 opening on - including after the July 1 lock, when councils usually vote. An approved year is frozen: every write rejects BUDGET_YEAR_APPROVED, and no override lifts it. budget.getBudgetProgress and budget.getHistoricalKPIs compare the approved figures with actual spend counted as in reports.monthlySummary (events by StartDate, expense line items by DateOfExpense, charity checks by PayoutDate), charged to the Event line of the same name, the Donation line of the charity or the Council Meetings line, the rest as unbudgeted; they are read by the executive summaries' readers (assertMayReviewBudgetPerformance).
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id). A council cannot be deleted while it has budget lines.
•	FraternalYear (VARCHAR(9), NOT NULL) — The budget year as 'YYYY-YYYY' with consecutive years, e.g. 2027-2028.
•	CategoryType (VARCHAR(50), NOT NULL) — Event (an annual event), Donation (an annual charity) or Operational (council meetings and custom running costs). Enforced by the shared rules layer.
•	ReferenceSourceID (INTEGER, NULL) — The source of an Event line (Event.id) or a Donation line (GlobalCharityRegistry.id); NULL for Operational lines. No foreign key, because the table it points at depends on CategoryType.
•	LineItemName (VARCHAR(255), NOT NULL) — The line's name: the event or charity name for sourced lines (kept current on re-seeding), 'Council Meetings' for the meetings line, or the name given to a custom line. Operational names are unique per council and year ignoring case (BUDGET_LINE_EXISTS).
•	PrePopulatedAmount (DECIMAL(18,2), NOT NULL, DEFAULT 0.00) — Last fraternal year's actual spend on the line: an event's Spend plus its linked expenses, the sum of the charity's checks, or the expenses linked to the council's meetings. For a custom line, which has no spend to read, last year's approved cap for the line of the same name (Sprint 5Y-6.5; 0 when last year was never approved, and 0 for a line added by hand).
•	ApprovedBudgetAmount (DECIMAL(18,2), NOT NULL, DEFAULT 0.00) — Sprint 5Y-4: the figure the council voted, set only by budget.approveAndFinalizeEntireBudget (a copy of ProposedBudgetAmount); 0 until then. The cap the dashboard's budget gauges measure spend against. Pre-population never changes it.
•	Notes (TEXT, NULL) — Optional reviewer notes; at most 2,000 characters.
•	BudgetCategoryID (INTEGER, NULL) — Sprint 5Y-3: Foreign Key references CouncilBudgetCategory(id). The council budget category (fund) the line is filed under; it must be one of the line's own council's categories. NULL while uncategorized. A new pre-populated line takes the category of the previous year's line it continues.
•	ProposedBudgetAmount (DECIMAL(18,2), NOT NULL, DEFAULT 0.00) — Sprint 5Y-4: the figure leadership or the Budget Director drafts May 1 - June 30 (budget.updateLineItemBudget, or a custom line's figure from budget.addCustomBudgetLine), 0 or more. Pre-population never changes it.
•	BudgetStatus (VARCHAR(20), NOT NULL) — Sprint 5Y-4: Draft (a seeded line with nothing proposed), Proposed (a figure was drafted, and every custom line) or Approved (the year was approved and finalized; all of a year's lines are approved together). Written by every insert; enforced by the shared rules layer.
A unique index on (CouncilID, FraternalYear, CategoryType, ReferenceSourceID, LineItemName) keeps lines from repeating. SQLite lets NULL ReferenceSourceIDs repeat in it, so the drivers also refuse a duplicate Operational name.
[CouncilBudgetCategory]
Sprint 5Y-3: one of a council's own budget categories (funds), under which the Annual Budget Projections group its lines and subtotal them. A council lookup table (lookups.listCouncilSpecific / saveCouncilSpecific / removeCouncilSpecific) kept by the council's Admins, Financial Secretary and Treasurer, or a Super Admin. Seed.sql gives Council 15295 its six funds; every other council defines its own. A category cannot be deleted while budget lines are filed under it (RECORD_IN_USE).
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id). A council cannot be deleted while it has budget categories.
•	CategoryName (VARCHAR(255), NOT NULL) — The category's name, e.g. Blessed Michael McGivney Fraternal Activities Fund. Unique per council (a unique index on CouncilID, CategoryName; the drivers also ignore case and spacing).
________________________________________

# 12. Normalized Charitable Intake and Mission Areas (Sprint 5Z-1)
[CouncilRelationshipType]
A council lookup table: how an organization asking the council for money is connected to it. Each council keeps its own; Seed.sql gives Council 15295 its six standard types (Parish Ministry, Catholic School, Local Nonprofit, Member or Family in Need, Community Partner, State or Supreme Program). Read with charities.listCouncilRelationshipTypes, by name. A council cannot be deleted while it has relationship types.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
•	RelationshipName (VARCHAR(100), NOT NULL) — The type's name. Unique per council (a unique index on CouncilID, RelationshipName).
[CouncilMissionArea]
A council lookup table of mission pillars under which events, meetings and (Sprint 5Z-2) charitable requests are filed (Event.MissionAreaID, Meeting.MissionAreaID, CharitableRequest.MissionAreaID). reports.missionAreaFootprint sums a fraternal year's recorded donations and volunteer hours at the council's events by the events' mission areas for the executive dashboard's Faith-in-Action Mission Tracking card. Seed.sql gives Council 15295 the four Faith in Action pillars: Faith, Family, Community and Life. Read with charities.listCouncilMissionAreas, by name. A council cannot be deleted while it has mission areas.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
•	MissionAreaName (VARCHAR(100), NOT NULL) — The pillar's name. Unique per council (a unique index on CouncilID, MissionAreaName).
[CharitableRequest]
A Knight Shepherd's intake form for an outside organization asking the council for money. Any Active member (the Shepherd) files it into their own council's shared vetting queue with charities.submitCharitableRequest. Anyone with vetting authority - the council's Active officers (any Role with Officer = 1, the three Trustees included) and Admins, or an Active Super Admin (assertMayVetCharitableRequests) - reads the queue (charities.listCharitableRequestsQueue) and triages requests with charities.triageRequestStatus: 'claim' a Submitted request, add 'note's to a claimed one, 'advance' it to the council's vote or (Sprint 5Z-2) 'decline' it. Vetting is independent: the Shepherd may never vet their own request (SELF_VETTING_BLOCKED), and only the claiming vetter, an Admin or a Super Admin may change a claimed request (REQUEST_STATUS_CONFLICT). The table is created with its core intake columns; the process-form columns from ShepherdMemberID on are appended by explicit ALTER TABLE ... ADD statements. A council cannot be deleted while it has requests.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id). Always the Shepherd's own council.
•	OrganizationName (VARCHAR(255), NOT NULL) — The organization asking for money.
•	ContactName (VARCHAR(255), NULL) — The organization's contact person.
•	ContactPhone (VARCHAR(50), NULL) — The contact's phone.
•	ContactEmail (VARCHAR(255), NULL) — The contact's email address.
•	AmountRequested (DECIMAL(18,2), NOT NULL) — The sum asked for, more than 0, to the cent.
•	RequestStatus (VARCHAR(50), NOT NULL, DEFAULT 'Submitted') — Submitted, Claimed by Trustee, then Advanced or (Sprint 5Z-2) Declined, in that order only. Enforced by the shared rules layer (no CHECK).
•	SubmittedAt (DATETIME, NOT NULL, DEFAULT getdate()) — When the Shepherd filed the form (UTC). The queue lists requests by stage, then oldest first. The Trustees' status-report prompt falls 6 calendar months later (charitableTrusteeFollowUpDate).
•	ShepherdMemberID (INTEGER, NOT NULL, DEFAULT 0) — Foreign Key references Member(id). The Knight Shepherd who carries the request; always the member who submitted it.
•	MailingAddress (TEXT, NULL) — Where a check would be mailed.
•	RelationshipTypeID (INTEGER, NULL) — Foreign Key references CouncilRelationshipType(id). Must be one of the council's own types (INVALID_INPUT).
•	Is501c3 (BIT, NOT NULL, DEFAULT 0) — The organization is a registered 501(c)(3) charity.
•	EIN (VARCHAR(50), NULL) — The organization's IRS Employer Identification Number, stored as 'NN-NNNNNNN'.
•	Website (VARCHAR(255), NULL) — The organization's website.
•	OrgMission (TEXT, NULL) — The organization's mission, in the Shepherd's words; at most 2,000 characters.
•	IsRecurring (BIT, NOT NULL, DEFAULT 0) — The organization expects to ask every year.
•	FundsNeededBy (DATETIME, NULL) — The date the money is needed by, stored as 'YYYY-MM-DD 00:00:00'.
•	SpecificUse (TEXT, NULL) — What the money will buy; at most 2,000 characters.
•	TargetBeneficiary (TEXT, NULL) — Who the gift will help; at most 2,000 characters.
•	AccountabilityPlan (TEXT, NULL) — How the organization will report back to the council; at most 2,000 characters.
•	RequestTier (INTEGER, NOT NULL, DEFAULT 1) — The request's review tier, 1 to 3 (CHARITABLE_REQUEST_MAX_TIER). Sprint 5Z-Member-Charity: the member form no longer offers it, so every request is filed at tier 1 and the vetter sets the tier.
•	VetterMemberID (INTEGER, NULL) — Foreign Key references Member(id). The officer or Trustee who claimed the request; NULL while it is Submitted.
•	VettingNotes (TEXT, NULL) — The vetter's notes; at most 2,000 characters (CHARITABLE_VETTING_NOTES_MAX_LENGTH).
•	VettedDate (DATETIME, NULL) — When the request was advanced to the vote (UTC).
•	MoverMemberID (INTEGER, NULL) — Foreign Key references Member(id). The member who moved the gift at the council's vote.
•	SeconderMemberID (INTEGER, NULL) — Foreign Key references Member(id). The member who seconded the motion.
•	VoteStatus (VARCHAR(50), NOT NULL, DEFAULT 'Pending') — The council's vote on an advanced request: Pending, Approved or Rejected. Sprint 5Z-9: meetings.finalizeProposedMotionVote records it from the motion carrying the request - Passed sets Approved with AmountApproved = AmountRequested (the request then joins the Financial Secretary's funding queue, charities.listApprovedFundingQueue, until a check pays it), Failed sets Rejected, Tabled leaves it Pending.
•	AmountApproved (DECIMAL(18,2), NOT NULL, DEFAULT 0.00) — The sum the council voted; 0.00 until the vote.
•	PaymentOrderId (INTEGER, NULL) — Foreign Key references CharitableDisbursementLedger(id). The check that paid the request.
Workflow rule (Sprint 5Z-Member-Charity). A request enters only through the members-only Propose Charity Grant page (/charities/propose); there is no public intake form or route. The Shepherd is never typed: the data service records the signed-in member as ShepherdMemberID. Saving the form MUST dispatch the Shepherd's tracking notice (dispatchCharitableTrackingNotice) naming the three steps the request moves through - Vetting (Submitted, Claimed by Trustee), Presentation (Advanced, the council's vote at a Monthly meeting) and Disbursement (Approved, until the Financial Secretary or Treasurer pays the check) - and MUST schedule the Trustees' status-report prompt CHARITABLE_TRUSTEE_FOLLOWUP_MONTHS (6) calendar months after SubmittedAt, clamped to the last day of a short month. No SMS gateway or profile-log table exists yet, so, like the hours reminders, the notice is printed with console.log; the follow-up date is derived from SubmittedAt rather than stored. charities.listMyCharitableRequests gives the Shepherd their own requests, newest first, and charitableTrackingPosition places each on the track.
•	MissionAreaID (INTEGER, NULL) — Sprint 5Z-2: Foreign Key references CouncilMissionArea(id). The mission area the Shepherd files the request under on the intake form; must be one of the council's own (INVALID_INPUT).
•	TargetBudgetLineID (INTEGER, NULL) — Sprint 5Z-2: Foreign Key references CouncilBudgetForecast(id). The budget line the vetter would pay the gift from, set from the Pooled Vetting Desk (triageRequestStatus); must be a line of the request's council (INVALID_INPUT).
Seed.sql's presentation data (loaded by the apps, not by the automated tests) puts five requests in the pipeline for Council 15295: two Submitted, two Claimed by Trustee and one Advanced.
________________________________________
# 13. Parliamentary Cadence and Proposed Motions (Sprint 5Z-5)
Schema version 24 (25 adds DefaultRecipientGroup and Meeting.InviteReleaseDate). Both tables are council-scoped and block deleting their council (RECORD_IN_USE).
[CouncilCadenceConfig]
A council's standing recurrence rule for one of its own meeting types. meetings.populateAnnualCadence expands it into the twelve meetings of a fraternal year (July through June): one per month on the day CadencePattern names, from DefaultStartTime for 120 minutes (CADENCE_MEETING_MINUTES; never past 23:59) at DefaultLocation, filed under the config's meeting type with the council's agenda template for it and no owner. Since Sprint 5Z-6 each meeting invites the config's DefaultRecipientGroup at once, held back from members' feeds until Meeting.InviteReleaseDate (5 days before). The Cadence Engine (/meetings/cadence) lists, saves and removes configs (meetings.listCadenceConfigs, saveCadenceConfig, removeCadenceConfig) and runs the population. A date that already has a meeting of that type is skipped, so the run can be repeated. Run by an Active Admin or Grand Knight of the council, or an Active Super Admin (assertMayScheduleCouncilCadence). Seed.sql's baseline gives Council 15295 one config: Monthly, First Tuesday, 19:30, Parish Hall.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
•	MeetingTypeID (INTEGER, NOT NULL) — Foreign Key references CouncilMeetingType(id). One of the council's own meeting types. One config per council and type (a unique index on CouncilID, MeetingTypeID).
•	CadencePattern (VARCHAR(100), NOT NULL) — An ordinal and a weekday: First, Second, Third, Fourth or Last, then Sunday through Saturday (e.g. 'First Tuesday', 'Last Thursday'); case and spacing are ignored. Fifth is not accepted, since not every month has one (parseCadencePattern, INVALID_INPUT).
•	DefaultStartTime (VARCHAR(50), NOT NULL) — The meetings' 24-hour start time, 'HH:MM' or 'HH:MM:SS'.
•	DefaultLocation (TEXT, NOT NULL) — Where the meetings are held; at most 100 characters (CADENCE_LOCATION_MAX_LENGTH, matching Meeting.Location).
•	DefaultRecipientGroup (VARCHAR(50), NOT NULL, DEFAULT 'all_members') — Sprint 5Z-6: who the cadence's meetings invite: all_members (every Active member), active_officers (Active members holding an officer seat) or none (invite by hand). CADENCE_RECIPIENT_GROUPS; rules layer, no CHECK. Appended by ALTER TABLE (schema version 25).
[ProposedMotion]
A motion queued for a meeting's floor. charities.routeRequestToNextEligibleAgenda adds one for a vetted charitable request (RequestStatus Advanced, VoteStatus Pending) to the council's soonest Monthly meeting that honors the 10-day rule: the meeting must fall at least 10 calendar days after today (AGENDA_NOTICE_DAYS). A request is carried by at most one Pending motion at a time. Routing takes vetting authority of the request's council and is independent of the request: its Knight Shepherd may not route it (SELF_VETTING_BLOCKED). With no eligible meeting it rejects NO_ELIGIBLE_MEETING.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
•	TargetMeetingID (INTEGER, NOT NULL) — Foreign Key references Meeting(id). A meeting of the same council.
•	SourceType (VARCHAR(50), NOT NULL) — Where the motion came from: CharitableRequest or GeneralMember (PROPOSED_MOTION_SOURCE_TYPES; rules layer, no CHECK).
•	SourceRecordID (INTEGER, NULL) — The originating row: the CharitableRequest id for SourceType CharitableRequest; NULL for a member's own motion. Polymorphic, so it carries no foreign key.
•	MotionText (TEXT, NOT NULL) — The motion as read to the floor. A routed request reads 'That the council donate $<amount> to <organization> (charitable request #<id>).'
•	PresenterMemberID (INTEGER, NOT NULL) — Foreign Key references Member(id). Who presents the motion; the Knight Shepherd for a routed request.
•	AllocatedMinutes (INTEGER, NOT NULL, DEFAULT 5) — Floor time set aside for the motion.
•	VoteResult (VARCHAR(50), NOT NULL, DEFAULT 'Pending') — Pending, Passed, Failed or Tabled (PROPOSED_MOTION_VOTE_RESULTS; rules layer, no CHECK). Sprint 5Z-9: set by meetings.finalizeProposedMotionVote; when a smartphone ballot was held the decision must agree with it (VOTE_TALLY_CONFLICT: Passed needs more Approve than Deny ballots).
•	BallotOpenedAt (DATETIME, NULL) — Sprint 5Z-9, added beyond the step's column list: when the motion's secret smartphone ballot opened (meetings.launchSecretSmartphoneBallot). The ballot is open while this is set and VoteResult is still Pending; one ballot at a time per meeting. Appended by ALTER TABLE (schema version 28).
________________________________________
# 14. Double-Entry General Ledger and Balance Sheet (Sprint 5Z-7)
Schema version 26 (27 adds JournalEntry.TransactionID and the Opening Balance Equity account). Both tables are council-scoped and block deleting their council (RECORD_IN_USE). Every money column is summed in whole cents, so the books balance to the penny. The council's Active Admins and officers (the executive dashboard's audience) and any Active Super Admin read the books (finance.listChartOfAccounts, finance.getLatestBalanceSheet; assertMayReadGeneralLedger). Only an Active Financial Secretary or Treasurer of the council, or an Active Super Admin, posts to them or reconciles them (finance.logDoubleEntryTransaction, transferAssetFunds, uploadBankStatementReconciliation; assertMayPostGeneralLedger, FINANCE_OFFICER_REQUIRED).
[GLAccount]
A council's chart of accounts. Seed.sql's baseline gives Council 15295 its standard chart (ids 1-14): the Asset accounts Operating Checking, Goal Account #1 and Goal Account #2 (virtual goals under Operating Checking), General Savings, Charity Savings and Physical Assets; the Revenue accounts Member Dues Collections, Parking Fundraising, General Fundraising and General Donations; and the Expense accounts Charitable Disbursements, Event Operational Costs, Council Operational Costs and Supreme Assessments. Sprint 5Z-8 adds the Equity account Opening Balance Equity (id 15), which takes the other side of the balances a council carries into the ledger, and sets the goal targets: Goal Account #1 $4,000.00, Goal Account #2 $1,500.00. Seed.sql's presentation data posts fourteen balanced transactions (TransactionIDs seed-txn-0001 to seed-txn-0014) from the July 1, 2026 opening balances through September 15, 2026. finance.listChartOfAccounts returns the accounts as a tree, each with its own balance and its balance rolled up with its descendants.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
•	AccountName (VARCHAR(100), NOT NULL) — The account's name; one per council (a unique index on CouncilID, AccountName).
•	AccountType (VARCHAR(50), NOT NULL) — Asset, Liability, Equity, Revenue or Expense (GL_ACCOUNT_TYPES; rules layer, no CHECK). Asset and Expense balances grow with debits; Liability, Equity and Revenue balances grow with credits.
•	ParentAccountID (INTEGER, NULL) — Foreign Key references GLAccount(id). The account this one is nested under, in the same council; NULL for a top-level account.
•	IsVirtualGoal (BIT, NOT NULL, DEFAULT 0) — The account is an earmark inside its parent asset account, not a bank account of its own: money moved into it (finance.transferAssetFunds) is still held by the parent's bank account, so bank reconciliation never matches its entries.
•	TargetGoalAmount (DECIMAL(18,2), NOT NULL, DEFAULT 0.00) — What a virtual goal is saving toward; 0.00 until leadership sets it. The Financial Management Center (/finance/dashboard) shows each goal's balance against it.
[JournalEntry]
One line of a posted double-entry transaction. finance.logDoubleEntryTransaction posts two to 100 lines (JOURNAL_MAX_LINES) at once, all to accounts of one council, and only when their debits equal their credits to the cent (UNBALANCED_TRANSACTION otherwise); finance.transferAssetFunds posts a debit to the target Asset account and a credit to the source, and refuses to move more than the source's own balance (INSUFFICIENT_FUNDS). finance.getLatestBalanceSheet totals every entry: Assets (physical property and virtual goals included) against Liabilities plus Equity plus the current surplus of Revenue over Expenses, and reports whether they balance to the penny.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id). Always the account's council.
•	GLAccountID (INTEGER, NOT NULL) — Foreign Key references GLAccount(id).
•	DateLogged (DATETIME, NOT NULL) — 'YYYY-MM-DD HH:MM:SS'. A date alone is stored as midnight; omitted, it is stamped now (UTC, like the platform's other DATETIME stamps).
•	Description (TEXT, NOT NULL) — What the line records; at most 2000 characters (JOURNAL_DESCRIPTION_MAX_LENGTH). A transfer defaults to 'Transfer from <source> to <target>'.
•	DebitAmount (DECIMAL(18,2), NOT NULL, DEFAULT 0.00) — Exactly one of DebitAmount and CreditAmount is above 0, in whole cents.
•	CreditAmount (DECIMAL(18,2), NOT NULL, DEFAULT 0.00) — See DebitAmount.
•	LinkedEventID (INTEGER, NULL) — Foreign Key references Event(id). An event linked to the line's council (INVALID_INPUT otherwise).
•	LinkedMeetingID (INTEGER, NULL) — Foreign Key references Meeting(id). A meeting of the line's council (INVALID_INPUT otherwise).
•	IsBankReconciled (BIT, NOT NULL, DEFAULT 0) — Set by finance.uploadBankStatementReconciliation when a bank statement row matches the line. The statement is a CSV with a header row: a Date column (YYYY-MM-DD or MM/DD/YYYY) and a signed Amount column or Withdrawal and Deposit columns, with optional Description and Check Number columns. A deposit matches a debit of the same amount and a withdrawal a credit, among the council's unreconciled lines on Asset accounts that are not virtual goals (or on one such account the caller names). A row with a check number matches only a line with that check number; any other row matches the line dated closest to it within 5 days (BANK_MATCH_WINDOW_DAYS). Each line is matched once; unmatched rows are reported back, not rejected.
•	CheckNumber (VARCHAR(50), NULL) — The check that moved the money, when there was one.
•	TransactionID (VARCHAR(50), NOT NULL) — Sprint 5Z-8: groups the lines of one posting. finance.logDoubleEntryTransaction and finance.transferAssetFunds stamp every line they write with one freshly generated version 4 UUID (formatTransactionId; Web Crypto on the web, expo-crypto on the phone), so the lines of a posting always balance among themselves. finance.getAccountLedger shows each line of an account with every line of its posting (the /finance/ledger drill-down drawer), and since Sprint 5Z-9 the linked event's full name beside its #ID. Indexed (JournalEntry_Transaction_Idx). Appended by ALTER TABLE (schema version 27).
________________________________________
# 15. Live Meeting Management and Smartphone Balloting (Sprint 5Z-9)
Schema version 28. Both tables are council-scoped and block deleting their council (RECORD_IN_USE). The live console is run by the meeting's chair: its Active owner, an Active Admin or officer of its council, or an Active Super Admin (assertMayRunLiveAssembly). Any Active member of the council follows it (meetings.getLiveAssemblyState: the center bar with its countdown, the locked roster and check-in counts, and every motion's ballot state and live tally).
[LiveAttendance]
The live check-in roster. meetings.logLiveAttendanceOverride checks a member in while the meeting is live, whatever they answered to the invitation: a member checks themselves in from their phone, or the chair checks someone in. The member must be an Active member of the meeting's council (NOT_ACTIVE_COUNCIL_MEMBER). Their MeetingInvites row is marked Attended and Accepted (created when they had none), so the meeting counts toward their hours. Only members checked in may vote.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id). The meeting's council.
•	MeetingID (INTEGER, NOT NULL) — Foreign Key references Meeting(id).
•	MemberID (INTEGER, NOT NULL) — Foreign Key references Member(id). One check-in per meeting and member (a unique index on MeetingID, MemberID); checking in again returns the first.
•	CheckedInAt (DATETIME, NOT NULL) — When the member checked in ('YYYY-MM-DD HH:MM:SS' UTC).
[BallotVote]
A secret smartphone ballot. meetings.castAnonymousMobileVote stores one per checked-in member and motion while the motion's ballot is open, and answers with the live tally. The row never names its voter.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
•	ProposedMotionID (INTEGER, NOT NULL) — Foreign Key references ProposedMotion(id).
•	AnonymousBallotHash (VARCHAR(255), NOT NULL) — SHA-256 (64 hex characters) of the motion and the voter under a secret ballot key kept outside the database (the web mock's per-session key; on the phone, a key in the device's secure store). Without the key the tables cannot be used to find who voted; with it, a member's second ballot on the same motion hashes the same and is refused (BALLOT_ALREADY_CAST; a unique index on ProposedMotionID, AnonymousBallotHash). A production backend must keep its key server-side.
•	VoteSelection (VARCHAR(50), NOT NULL) — Approve, Deny or Abstain (BALLOT_SELECTIONS; rules layer, no CHECK).
•	CastAt (DATETIME, NOT NULL) — When the ballot was cast ('YYYY-MM-DD HH:MM:SS' UTC).
________________________________________
# 16. The St. Mary's Live Agenda and Hand-Vote Tallies (Sprint 6B)
Schema version 31. Both tables are council-scoped and block deleting their council (RECORD_IN_USE). Every Active member of the meeting's council (or a Super Admin) reads the agenda (meetings.getMeetingAgenda). Its editors - the council's Active Grand Knight or Recorder, its Active Admins, or an Active Super Admin (assertMayEditLiveAgenda) - lay it out from the St. Mary's blueprint (meetings.applyAgendaBlueprint), correct any line live (meetings.editAgendaLine) and record hand votes (meetings.recordHandBallotTally).
[MeetingAgendaItem]
One line of a meeting's St. Mary's order of business. Speakers are looked up when the agenda is read, never copied. New Business also lists every motion of the meeting no item carries, and Upcoming Events lists the council's events ending on or after the meeting's date (at most 8); a correction to one of those generated lines is stored here carrying ProposedMotionID or LinkedEventID.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id). The meeting's council.
•	MeetingID (INTEGER, NOT NULL) — Foreign Key references Meeting(id).
•	SectionKey (VARCHAR(50), NOT NULL) — opening, officer_reports, director_reports, new_business, old_business, upcoming_events or good_of_order (AGENDA_SECTION_KEYS; rules layer, no CHECK).
•	SortOrder (INTEGER, NOT NULL, DEFAULT 0) — The line's place in its section (then id). A corrected motion line sorts at 10000 + its motion id, where the generated line stood.
•	LineMarkdown (TEXT, NOT NULL) — The line in light markdown: **bold**, *italic*, and lines starting '- ' as bullets; at most 2,000 characters (AGENDA_LINE_MAX_LENGTH). The console renders it without HTML.
•	SpeakerRoleID (INTEGER, NULL) — Foreign Key references Role(id). A seat: the speaker is its most recently seated (highest MemberRoles id) Active holder in the meeting's council, so the line follows elections.
•	SpeakerMemberID (INTEGER, NULL) — Foreign Key references Member(id). A named member, shown ahead of the seat's holder.
•	SpeakerLabel (VARCHAR(100), NULL) — The printed speaker when no member resolves: a guest ('State Deputy John Snyder') or a vacant seat ('Monsignor').
•	ProposedMotionID (INTEGER, NULL) — Foreign Key references ProposedMotion(id). A legislative line; under New or Old Business it carries the Recorder's hand-vote console.
•	LinkedEventID (INTEGER, NULL) — Foreign Key references Event(id). An Upcoming Events correction: replaces that event's generated line.
•	LastEditedByMemberID (INTEGER, NULL) — Foreign Key references Member(id). Who last corrected the line.
•	LastEditedAt (DATETIME, NULL) — When ('YYYY-MM-DD HH:MM:SS' UTC); NULL for a line never corrected.
[MotionHandTally]
The Recorder's count of a show of hands on a motion, one per motion (a unique index on ProposedMotionID). Recording it decides the motion in the same transaction - more Approved than Denied is Passed, a tie or fewer is Failed - with the same charitable-request effect as a decided ballot. Only a 'Pending' motion that never went to a smartphone ballot takes a hand tally (MOTION_STATUS_CONFLICT, BALLOT_STATE_CONFLICT).
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	CouncilID (INTEGER, NOT NULL) — Foreign Key references Council(id).
•	ProposedMotionID (INTEGER, NOT NULL) — Foreign Key references ProposedMotion(id).
•	ApprovedCount (INTEGER, NOT NULL) — Hands for, 0 to 9,999.
•	DeniedCount (INTEGER, NOT NULL) — Hands against, 0 to 9,999; the two together count at least one hand.
•	RecordedByMemberID (INTEGER, NOT NULL) — Foreign Key references Member(id). The editor who entered the count.
•	RecordedAt (DATETIME, NOT NULL) — When ('YYYY-MM-DD HH:MM:SS' UTC).
•	LinkedTransactionID (VARCHAR(50), NULL) — JournalEntry.TransactionID of the council's posting that released the passed motion's capital (no foreign key: TransactionID is shared by a posting's lines). Set when the tally is recorded or later by meetings.linkHandTallyTransaction (the editors or the council's finance officers); NULL unlinks. Refused on a motion that failed.
________________________________________
# 17. Last-Minute Agenda Lines, Live Line Tracking and Supreme New-Member Onboarding (Sprint 6B Patch)
Schema version 32. meetings.addAgendaLine stores a blank MeetingAgendaItem at the end of a section (after New Business's generated motion lines) for the agenda's editors to write; readers who are not editors never see a blank line. meetings.advanceActiveAgendaItem takes the agenda line it puts on the floor, so the phones' agenda sheet frames that exact line.
[Meeting] (additional column)
•	ActiveAgendaLineKey (VARCHAR(50), NULL) — The agenda line on the floor: 'item:N', 'motion:N' or 'event:N' (AgendaLineView.key; cleanAgendaLineKey). Set with the center bar by meetings.advanceActiveAgendaItem (options.lineKey), NULL for a topic typed in by hand, cleared by closeLiveAssemblyConsole. Returned to every reader as LiveAgendaItem.lineKey.
[Member] (additional column)
•	DateJoinedCouncil (DATE, NULL) — The day the member joined the council, from Supreme Headquarters' roster (supreme.syncSupremeRoster) or entered by an Admin; never in the future nor on or before the date of birth. The member wears the '[🆕 New Member]' badge on rosters, roll calls, shift rosters and member drop-downs for 180 days from it, the join day being day 1; it is gone on day 181 (isNewMember). NULL when not known (no badge).
•	flag_large_text_mode (BIT, NOT NULL, DEFAULT 0) — Sprint 6C: the member's own Large Text Layout Mode preference, switched from My Profile on the web portal or Settings on the phone app (a self-service column of members.update). At 1 the phone app doubles every font size, makes every tap area at least 140 points tall, and draws a pitch-black background with bold white text and thick gold borders (largeTextLayout). Appended by ALTER TABLE (schema version 34).
[MemberEnrollmentToken]
A new member's one-time setup code, issued by the post-insert welcome email that follows members.create and supreme.syncSupremeRoster. The code itself (20 Crockford base-32 characters, 'XXXXX-XXXXX-XXXXX-XXXXX') appears only in the email; auth.signUp(email, password, code) checks it against this member's unspent, unexpired codes (ENROLLMENT_CODE_INVALID otherwise) and spends it. A sign-up without a code still works by email alone.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	MemberID (INTEGER, NOT NULL) — Foreign Key references Member(id). The member the code was issued to.
•	TokenHash (VARCHAR(64), NOT NULL) — SHA-256 hex of the normalised code (enrollmentCodeHashInput); the code is never stored. Unique index.
•	CreatedAt (DATETIME, NOT NULL) — When it was issued ('YYYY-MM-DD HH:MM:SS' UTC).
•	ExpiresAt (DATETIME, NOT NULL) — ENROLLMENT_CODE_LIFETIME_DAYS (14) after CreatedAt.
•	ConsumedAt (DATETIME, NULL) — When auth.signUp spent it; NULL while unspent.
________________________________________
# 18. Mandatory Setup Codes and Self-Service Password Resets (Sprint 6B Security Extension)
Schema version 33. auth.signUp now refuses any registration without a valid MemberEnrollmentToken setup code (ENROLLMENT_CODE_INVALID, nothing written), so an email address alone no longer claims an account. An Admin sends a fresh code with members.resendWelcome. The dev seed's pre-provisioned member carries the published dev code DEV_ENROLLMENT_CODE (apps/*/services/seed-dev.ts), dev data like the dev password.
[PasswordResetToken]
A 6-digit password reset code. auth.requestPasswordReset emails one (as a SendGrid request) to a member who has registered, answering exactly the same for any other email so the form cannot reveal who is a member; a request within 60 seconds of the last sends nothing, and a new code retires every earlier unspent one. auth.verifyPasswordResetCode checks a code and auth.resetPassword spends it to set the new password; every failure reads RESET_CODE_INVALID.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	MemberID (INTEGER, NOT NULL) — Foreign Key references Member(id). Indexed.
•	CodeHash (VARCHAR(64), NOT NULL) — SHA-256 hex of the code keyed by the member (resetCodeHashInput); the code itself is never stored.
•	CreatedAt (DATETIME, NOT NULL) — When it was issued ('YYYY-MM-DD HH:MM:SS' UTC); also the cooldown clock.
•	ExpiresAt (DATETIME, NOT NULL) — RESET_CODE_LIFETIME_MINUTES (15) after CreatedAt.
•	ConsumedAt (DATETIME, NULL) — When it was spent by auth.resetPassword or retired by a newer request; NULL while it works.
•	FailedAttempts (INTEGER, NOT NULL, DEFAULT 0) — Wrong guesses so far; at RESET_CODE_MAX_ATTEMPTS (5) the code is dead even for the right digits.
________________________________________
