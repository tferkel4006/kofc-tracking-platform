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
[MeetingInvites]
Tracks meeting rosters, invitations, and recorded user attendance.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	MeetingID (INTEGER, NULL) — Foreign Key references Meeting(id).
•	MemberID (INTEGER, NULL) — Foreign Key references Member(id).
•	Attended (BIT, DEFAULT 0) — Attendance flag (1 = Present, 0 = Absent/No-Show).

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
Custom recipient groups assembled by administrators for bulk communication.
•	id (INTEGER, NOT NULL) — Primary Key. Auto-incrementing identifier.
•	ListName (VARCHAR(100), NULL) — Group reference name (e.g., 'Officers Distribution List').
•	CouncilID (INTEGER, NULL) — Foreign Key references Council(id).
•	CreatedBy (INTEGER, NULL) — Foreign Key references Member(id) (Tracks list author).
•	CreatedAt (DATETIME, DEFAULT GETDATE()) — Initialization creation timestamp.
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
One check that pays one or more approved expense reports of a council. Recorded only by the council's leadership (expenses.recordDisbursement).
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
•	Status (VARCHAR(50), NOT NULL) — Draft, Submitted, Approved or Reimbursed. Only drafts may be edited; leadership approves Submitted sheets (never their own, unless a Super Admin), returns them to Draft with a reason, and pays Approved ones. Approved and Reimbursed line items count toward the monthly summary's spend.
•	LinkedEventID (INTEGER, NULL) — Foreign Key references Event(id). An event linked to the report's council.
•	LinkedMeetingID (INTEGER, NULL) — Foreign Key references Meeting(id). A meeting of the report's council.
•	DisbursementID (INTEGER, NULL) — Foreign Key references ExpenseDisbursement(id). The check that paid it; set with Status Reimbursed.
•	RejectionReason (VARCHAR(2000), NULL) — Why leadership returned the sheet to Draft (expenses.rejectReport); kept while it is a draft, cleared when it is submitted again.
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

