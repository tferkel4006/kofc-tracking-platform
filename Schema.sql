-- =========================================================================
-- KNIGHTS OF COLUMBUS UNIFIED APPLICATION SCHEMA
-- Optimized for Azure SQL (Production T-SQL) and Expo-SQLite (Local Mobile)
-- =========================================================================

-- 1. UTILITY / AUTHENTICATION LOOKUPS
CREATE TABLE [Credentials] (
	[id] INTEGER NOT NULL IDENTITY,
	[Username] VARCHAR(50) NOT NULL,
	[Password] VARCHAR(255) NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [MemberStatus] (
	[id] INTEGER NOT NULL IDENTITY,
	[Status] VARCHAR(30) NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [Degree] (
	[id] INTEGER NOT NULL IDENTITY,
	[Degree] VARCHAR(10) NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [MemberType] (
	[id] INTEGER NOT NULL IDENTITY,
	[Type] VARCHAR(15) NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [Role] (
	[id] INTEGER NOT NULL IDENTITY,
	[Role] VARCHAR(50) NOT NULL,
	[Officer] BIT NOT NULL DEFAULT 0,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [NoShowReason] (
	[id] INTEGER NOT NULL IDENTITY,
	[NoShowReasonCode] CHAR(1) NOT NULL,
	[NoShowReasonDescription] VARCHAR(100) NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [Category] (
	[id] INTEGER NOT NULL IDENTITY,
	[Category] VARCHAR(100) NOT NULL,
	[CategoryDescription] VARCHAR(255) NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [LessonsLearnedCategory] (
	[id] INTEGER NOT NULL IDENTITY,
	[LessonsLearnedCategory] VARCHAR(30) NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [MeetingType] (
	[id] INTEGER NOT NULL IDENTITY,
	[Type] VARCHAR(50),
	[Description] VARCHAR(255),
	PRIMARY KEY([id])
);
GO

-- 2. TENANT ORGANIZATIONAL STRUCTURE
CREATE TABLE [Council] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilNumber] INTEGER NOT NULL,
	[CouncilName] VARCHAR(100) NOT NULL,
	[State] VARCHAR(50) NOT NULL,
	[Phone] VARCHAR(50),
	[Email] VARCHAR(100) NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [AffiliatedCouncils] (
	[PrimaryCouncilID] INTEGER NOT NULL,
	[AffiliatedCouncilID] INTEGER NOT NULL,
	PRIMARY KEY([PrimaryCouncilID], [AffiliatedCouncilID])
);
GO

CREATE TABLE [Parish] (
	[id] INTEGER NOT NULL IDENTITY,
	[Name] VARCHAR(100) NOT NULL,
	[StreetAddress1] VARCHAR(255) NOT NULL,
	[StreetAddress2] VARCHAR(255),
	[City] VARCHAR(50) NOT NULL,
	[State] VARCHAR(50) NOT NULL,
	[Phone] VARCHAR(50),
	[CouncilID] INTEGER NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [Pastor] (
	[id] INTEGER NOT NULL IDENTITY,
	[FirstName] VARCHAR(50) NOT NULL,
	[LastName] VARCHAR(50) NOT NULL,
	[Phone] VARCHAR(50),
	[Email] VARCHAR(50),
	[ParishID] INTEGER NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [Meeting] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER,
	[Meeting Name] VARCHAR(100) NOT NULL,
	[Meeting Description] VARCHAR(255),
	[Date] DATE NOT NULL,
	[Time Start] TIME NOT NULL,
	[Time End] TIME NOT NULL,
	[Location] VARCHAR(100) NOT NULL,
	[Agenda] VARCHAR(MAX) NOT NULL, -- Fixed: T-SQL TEXT takes no length argument
	[MinutesURL] VARCHAR(255) NOT NULL,
	[MeetingType] INTEGER NOT NULL,
	[GoogleDriveMinutesURL] VARCHAR(2000) NULL, -- Sprint 5Q: shared Google Drive link to the minutes
	[GoogleDriveFlyerURL] VARCHAR(2000) NULL, -- Sprint 5Q: shared Google Drive link to the flyer
	[OwnerID] INTEGER NULL, -- Sprint 5Q: the member who runs the meeting; manages it alongside Admins and Super Admins
	[IsMultiDay] BIT NOT NULL DEFAULT 0, -- Sprint 5Y-5: the meeting spans more than one day
	[MeetingTypeID] INTEGER NULL, -- Sprint 5Y-5: the council's own meeting type (CouncilMeetingType)
	[EndDate] DATE NULL, -- Sprint 5Y-6: last day of a multi-day meeting (IsMultiDay = 1); NULL for a one-day meeting
	PRIMARY KEY([id])
);
GO

CREATE TABLE [MeetingInvites] (
	[id] INTEGER NOT NULL IDENTITY,
	[MeetingID] INTEGER,
	[MemberID] INTEGER,
	[Attended] BIT DEFAULT 0,
	[ResponseStatus] VARCHAR(50) NOT NULL DEFAULT 'NoResponse', -- Sprint 5Y-5: NoResponse, Accepted, Declined (rules layer, no CHECK)
	PRIMARY KEY([id])
);
GO


-- 3. CORE CORE MEMBER ENTITIES
CREATE TABLE [Member] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[MemberNumber] INTEGER NOT NULL,
	[MemberFirstName] VARCHAR(100) NOT NULL,
	[MemberLastName] VARCHAR(100) NOT NULL,
	[Phone] VARCHAR(50) NOT NULL,
	[StreetAddress1] VARCHAR(255) NOT NULL,
	[StreetAddress2] VARCHAR(255),
	[City] VARCHAR(50) NOT NULL,
	[State] VARCHAR(20) NOT NULL,
	[ZipCode] VARCHAR(15) NOT NULL,
	[Email] VARCHAR(50) NOT NULL,
	[DateOfBirth] DATE NOT NULL,
	[StatusID] INTEGER NOT NULL,
	[DegreeID] INTEGER NOT NULL,
	[MemberTypeID] INTEGER NOT NULL,
	[CredentialID] INTEGER NOT NULL,
	[WorkingStatusID] INTEGER, -- Phase 2: optional until the member fills in their profile
	[ProfilePhotoURL] VARCHAR(2000) NULL, -- Sprint 5S: the member's avatar (a local file path while there is no file store)
	[Biography] TEXT NULL, -- Sprint 5S: a short personal fraternal biography, written by the member
	[ExpoPushToken] VARCHAR(512) NULL, -- Sprint 5T: the phone's push address (ExponentPushToken[...]); never returned by member reads
	[IsBudgetDirector] BIT NOT NULL DEFAULT 0, -- Sprint 5Y-3: delegated by an Admin; may prepare the council's budget
	PRIMARY KEY([id])
);
GO

CREATE TABLE [MemberRoles] (
	[id] INTEGER NOT NULL IDENTITY,
	[RoleID] INTEGER NOT NULL,
	[MemberID] INTEGER NOT NULL,
	PRIMARY KEY([id])
);
GO


-- 4. EVENTS, SHIFTS, & LOGS
CREATE TABLE [Event] (
	[id] INTEGER NOT NULL IDENTITY,
	[EventName] VARCHAR(100) NOT NULL,
	[EventDescription] VARCHAR(255) NOT NULL,
	[OwnerID] INTEGER NOT NULL,
	[StartDate] DATE NOT NULL,
	[EndDate] DATE NOT NULL,
	[Location] VARCHAR(255) NOT NULL,
	[CategoryID] INTEGER NOT NULL,
	[Budget] MONEY,
	[Spend] MONEY,
	[FundsRaised-Cash] MONEY,
	[FundsRaised-Electronic] MONEY,
	[Highlights] TEXT, -- Fixed length argument truncation
	[PlannedNumberAttendees] INTEGER,
	[ActualNumberAttendees] INTEGER,
	[PhotoGalleryURL] VARCHAR(2000) NULL, -- Sprint 5Q: comma-separated local photo reference paths
	[IsAnnual] BIT NOT NULL DEFAULT 0, -- Sprint 5Y: recurs every fraternal year; seeds the next year's budget forecast
	[IsMultiDay] BIT NOT NULL DEFAULT 0, -- Sprint 5Y-5: the event spans more than one day
	PRIMARY KEY([id])
);
GO

CREATE TABLE [EventCouncils] (
	[id] INTEGER NOT NULL IDENTITY,
	[EventID] INTEGER NOT NULL,
	[CouncilID] INTEGER NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [Shift] (
	[id] INTEGER NOT NULL IDENTITY,
	[ShiftName] VARCHAR(100) NOT NULL,
	[ShiftDescription] VARCHAR(255) NOT NULL,
	[ShiftDate] DATE NOT NULL,
	[StartTime] TIME NOT NULL,
	[EndTime] TIME NOT NULL,
	[EventID] INTEGER NOT NULL,
	[MinNumberVolunteers] INTEGER NOT NULL,
	[NumberVolunteersSignedUp] INTEGER NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [EventSignup] (
	[id] INTEGER NOT NULL IDENTITY,
	[ShiftID] INTEGER NOT NULL,
	[MemberID] INTEGER NOT NULL,
	[NoShow] BIT NOT NULL DEFAULT 0,
	[NoShowReasonID] INTEGER NULL, -- Fixed: Must be NULL-allowed on initial signup
	[SignupNotes] VARCHAR(255),
	PRIMARY KEY([id])
);
GO

CREATE TABLE [EventTime] (
	[id] INTEGER NOT NULL IDENTITY,
	[ShiftID] INTEGER NOT NULL,
	[MemberID] INTEGER NOT NULL,
	[Hours] DECIMAL(5,2) NOT NULL,
	[ShiftNotes] VARCHAR(255),
	PRIMARY KEY([id])
);
GO

CREATE TABLE [LessonsLearned] (
	[id] INTEGER NOT NULL IDENTITY,
	[EventID] INTEGER NOT NULL,
	[LeassonsLearnedCategoryID] INTEGER NOT NULL,
	[LessonsLearnedDescription] VARCHAR(255) NOT NULL,
	PRIMARY KEY([id])
);
GO


-- 5. STANDALONE COUNCIL ACTIVITIES
CREATE TABLE [Activities] (
	[id] INTEGER NOT NULL IDENTITY,
	[ActivityName] VARCHAR(100) NOT NULL,
	[ActivityDescription] VARCHAR(255) NOT NULL,
	[CategoryID] INTEGER NOT NULL,
	[CouncilID] INTEGER NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [ActivityTime] (
	[id] INTEGER NOT NULL IDENTITY,
	[MemberID] INTEGER NOT NULL,
	[ActivityID] INTEGER NOT NULL,
	[ActivityDate] DATE NOT NULL,
	[Hours] DECIMAL(5,2) NOT NULL,
	[ActivityNotes] VARCHAR(255),
	PRIMARY KEY([id])
);
GO


-- 6. ASYNCHRONOUS MESSAGING HUB
CREATE TABLE [DistributionLists] (
	[id] INTEGER NOT NULL IDENTITY,
	[ListName] VARCHAR(100),
	[CouncilID] INTEGER,
	[CreatedBy] INTEGER,
	[CreatedAt] DATETIME DEFAULT getdate(),
	PRIMARY KEY([id])
);
GO

CREATE TABLE [DistributionListMembers] (
	[ListID] INTEGER NOT NULL,
	[MemberID] INTEGER NOT NULL,
	PRIMARY KEY([ListID], [MemberID])
);
GO

CREATE TABLE [ChatThreads] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER,
	[IsGroupChat] BIT DEFAULT 0,
	[CreatedAt] DATETIME DEFAULT getdate(),
	PRIMARY KEY([id])
);
GO

CREATE TABLE [Messages] (
	[id] INTEGER NOT NULL IDENTITY,
	[ThreadID] INTEGER,
	[SenderID] INTEGER,
	[ParentMessageID] INTEGER,
	[MessageText] TEXT, -- Fixed length argument truncation
	[IsDraft] BIT DEFAULT 0,
	[CreatedAt] DATETIME DEFAULT getdate(),
	PRIMARY KEY([id])
);
GO

CREATE TABLE [MessageAttachments] (
	[id] INTEGER NOT NULL IDENTITY,
	[MessageID] INTEGER NOT NULL, -- Fixed dual identity error
	[Filename] VARCHAR(255) NOT NULL,
	[FileType] VARCHAR(100) NOT NULL,
	[StorageURL] VARCHAR(512) NOT NULL,
	[UploadedAt] DATETIME DEFAULT getdate(),
	PRIMARY KEY([id])
);
GO

CREATE TABLE [ReadReceipts] (
	[id] INTEGER NOT NULL IDENTITY,
	[MessageID] INTEGER,
	[MemberID] INTEGER,
	[ReadAt] DATETIME,
	[IsFlagged] BIT DEFAULT 0,
	PRIMARY KEY([id])
);
GO


-- 7. PERFORMANCE SPEED INDEXES
CREATE INDEX [Member_CouncilID_Idx] ON [Member] ([CouncilID]);
GO
CREATE INDEX [Council_Sort_Idx] ON [Council] ([CouncilNumber], [CouncilName]);
GO
CREATE INDEX [Member_Name_Idx] ON [Member] ([MemberLastName], [MemberFirstName]);
GO
CREATE INDEX [Event_Owner_Idx] ON [Event] ([OwnerID]);
GO
CREATE INDEX [EventSignup_Shift_Idx] ON [EventSignup] ([ShiftID]);
GO
CREATE INDEX [EventSignup_MemberID_Idx] ON [EventSignup] ([MemberID]);
GO
CREATE INDEX [EventTime_ShiftID_Idx] ON [EventTime] ([ShiftID]);
GO
CREATE INDEX [EventTime_MemberID_Idx] ON [EventTime] ([MemberID]);
GO
CREATE INDEX [ActivityTime_MemberID_Idx] ON [ActivityTime] ([MemberID]);
GO
CREATE INDEX [LessonsLearned_EventID_Idx] ON [LessonsLearned] ([EventID]);
GO

-- Index A: Accelerates Chat History Sorting & Thread Rendering
-- Optimizes: SELECT * FROM Messages WHERE ThreadID = ? ORDER BY CreatedAt DESC;
CREATE INDEX [IX_Messages_Thread_Timeline] 
ON [Messages] ([ThreadID], [CreatedAt] DESC) 
INCLUDE ([SenderID], [ParentMessageID]);
GO

-- Index B: Accelerates Real-time "Unread Badge" Multi-Tenant Counts
-- Optimizes filtering for rows where ReadAt IS NULL for a specific logged-in member.
CREATE INDEX [IX_ReadReceipts_UnreadTracker] 
ON [ReadReceipts] ([MemberID], [ReadAt]) 
INCLUDE ([MessageID], [IsFlagged]);
GO

-- Index C: Speeds up Document/Media Previews inside a Specific Chat Thread
-- Optimizes: Filtering the message tray to show "Attachments Only" without querying text columns.
CREATE INDEX [IX_MessageAttachments_Lookup] 
ON [MessageAttachments] ([MessageID]) 
INCLUDE ([Filename], [FileType], [StorageURL]);
GO

-- Index D: Speeds up Admin Multi-Tenant Filter Queries for Bulk Broadcast Blasts
-- Optimizes: Finding custom communication list subsets inside an isolated council.
CREATE INDEX [IX_DistributionLists_CouncilMappers] 
ON [DistributionLists] ([CouncilID], [CreatedBy]);
GO
-- Reference queries (NOT executed at deploy time; they use runtime @parameters).
-- They are implemented as DataService methods in each app's /services layer:
--
-- messages.getPage: keyset pagination utilizes the composite index perfectly
--   SELECT TOP 20 *
--   FROM [Messages]
--   WHERE [ThreadID] = @ActiveThreadID
--     AND [CreatedAt] < @OldestMessageTimestampOnScreen
--   ORDER BY [CreatedAt] DESC;
--
-- messages.createReadReceiptStubs: bulk insert read receipt stubs for an entire distribution list
--   INSERT INTO [ReadReceipts] ([MessageID], [MemberID], [ReadAt], [IsFlagged])
--   SELECT @NewMessageID, [MemberID], NULL, 0
--   FROM [DistributionListMembers]
--   WHERE [ListID] = @TargetListID;


-- 8. REFERENTIAL INTEGRITY (FOREIGN KEYS)
ALTER TABLE [Member] ADD FOREIGN KEY([CredentialID]) REFERENCES [Credentials]([id]);
GO
ALTER TABLE [Member] ADD FOREIGN KEY([DegreeID]) REFERENCES [Degree]([id]);
GO
ALTER TABLE [Member] ADD FOREIGN KEY([MemberTypeID]) REFERENCES [MemberType]([id]);
GO
ALTER TABLE [Member] ADD FOREIGN KEY([CouncilID]) REFERENCES [Council]([id]);
GO
ALTER TABLE [Member] ADD FOREIGN KEY([StatusID]) REFERENCES [MemberStatus]([id]);
GO
ALTER TABLE [Parish] ADD FOREIGN KEY([CouncilID]) REFERENCES [Council]([id]);
GO
ALTER TABLE [Pastor] ADD FOREIGN KEY([ParishID]) REFERENCES [Parish]([id]);
GO
ALTER TABLE [Shift] ADD FOREIGN KEY([EventID]) REFERENCES [Event]([id]);
GO
ALTER TABLE [Event] ADD FOREIGN KEY([CategoryID]) REFERENCES [Category]([id]);
GO
ALTER TABLE [Event] ADD FOREIGN KEY([OwnerID]) REFERENCES [Member]([id]);
GO
ALTER TABLE [EventSignup] ADD FOREIGN KEY([ShiftID]) REFERENCES [Shift]([id]);
GO
ALTER TABLE [EventSignup] ADD FOREIGN KEY([MemberID]) REFERENCES [Member]([id]);
GO
ALTER TABLE [EventSignup] ADD FOREIGN KEY([NoShowReasonID]) REFERENCES [NoShowReason]([id]);
GO
ALTER TABLE [EventTime] ADD FOREIGN KEY([MemberID]) REFERENCES [Member]([id]);
GO
ALTER TABLE [EventTime] ADD FOREIGN KEY([ShiftID]) REFERENCES [Shift]([id]);
GO
ALTER TABLE [MemberRoles] ADD FOREIGN KEY([MemberID]) REFERENCES [Member]([id]);
GO
ALTER TABLE [MemberRoles] ADD FOREIGN KEY([RoleID]) REFERENCES [Role]([id]);
GO
ALTER TABLE [Activities] ADD FOREIGN KEY([CategoryID]) REFERENCES [Category]([id]);
GO
ALTER TABLE [Activities] ADD FOREIGN KEY([CouncilID]) REFERENCES [Council]([id]);
GO
ALTER TABLE [ActivityTime] ADD FOREIGN KEY([MemberID]) REFERENCES [Member]([id]);
GO
ALTER TABLE [ActivityTime] ADD FOREIGN KEY([ActivityID]) REFERENCES [Activities]([id]);
GO
ALTER TABLE [LessonsLearned] ADD FOREIGN KEY([LeassonsLearnedCategoryID]) REFERENCES [LessonsLearnedCategory]([id]);
GO
ALTER TABLE [LessonsLearned] ADD FOREIGN KEY([EventID]) REFERENCES [Event]([id]);
GO
ALTER TABLE [Messages] ADD FOREIGN KEY([ThreadID]) REFERENCES [ChatThreads]([id]);
GO
ALTER TABLE [Messages] ADD FOREIGN KEY([SenderID]) REFERENCES [Member]([id]);
GO
ALTER TABLE [Messages] ADD FOREIGN KEY([ParentMessageID]) REFERENCES [Messages]([id]);
GO
ALTER TABLE [ChatThreads] ADD FOREIGN KEY([CouncilID]) REFERENCES [Council]([id]);
GO
ALTER TABLE [DistributionListMembers] ADD FOREIGN KEY([ListID]) REFERENCES DistributionLists;
GO
ALTER TABLE [DistributionListMembers] ADD FOREIGN KEY([MemberID]) REFERENCES Member;
GO
ALTER TABLE [ReadReceipts] ADD FOREIGN KEY([MessageID]) REFERENCES Messages;
GO
ALTER TABLE [ReadReceipts] ADD FOREIGN KEY([MemberID]) REFERENCES Member;
GO
ALTER TABLE [MessageAttachments] ADD FOREIGN KEY([MessageID]) REFERENCES Messages;
GO
ALTER TABLE [MeetingInvites] ADD FOREIGN KEY([MeetingID]) REFERENCES [Meeting]([id]); -- Fixed: was [Meeting Attendees] -> [Meetings]
GO
ALTER TABLE [MeetingInvites] ADD FOREIGN KEY([MemberID]) REFERENCES [Member]([id]);
GO
ALTER TABLE [Meeting] ADD FOREIGN KEY([MeetingType]) REFERENCES [MeetingType]([id]); -- Fixed: was [Meetings]
GO
ALTER TABLE [Meeting] ADD FOREIGN KEY([CouncilID]) REFERENCES [Council]([id]); -- Added: tenant link was missing
GO
ALTER TABLE [Meeting] ADD FOREIGN KEY([OwnerID]) REFERENCES [Member]([id]); -- Sprint 5Q: meeting owner
GO

-- 9. RE-ENGINEERED VIEWS FOR EXPO ROUTER/ADMIN PORTALS
CREATE OR ALTER VIEW [view_Member] AS
SELECT
[Council].[CouncilNumber],
[Council].[CouncilName],
[Member].[MemberNumber],
[Member].[MemberFirstName],
[Member].[MemberLastName],
[Member].[Phone],
[Member].[Email],
[Member].[StreetAddress1],
[Member].[City],
[Member].[State],
[Member].[ZipCode],
[Role].[Role],
[Degree].[Degree],
[MemberStatus].[Status]
FROM [Member]
INNER JOIN [Degree] ON [Member].[DegreeID] = [Degree].[id]
INNER JOIN [Council] ON [Member].[CouncilID] = [Council].[id]
INNER JOIN [MemberStatus] ON [Member].[StatusID] = [MemberStatus].[id]
INNER JOIN [MemberRoles] ON [Member].[id] = [MemberRoles].[MemberID]
INNER JOIN [Role] ON [MemberRoles].[RoleID] = [Role].[id]; -- Fixed Join path missing link
GO
CREATE OR ALTER VIEW [view_Event] AS
SELECT
[Council].[CouncilNumber],
[Council].[CouncilName],
[Event].[EventName],
[Event].[StartDate],
[Event].[EndDate],
[Event].[Location],
[OwnerMember].[MemberFirstName] AS [OwnerFirstName],
[OwnerMember].[MemberLastName] AS [OwnerLastName],
[Category].[Category],
[Shift].[ShiftName],
[Shift].[ShiftDate],
[Shift].[StartTime],
[Shift].[EndTime],
[Shift].[MinNumberVolunteers],
[Shift].[NumberVolunteersSignedUp],
[Event].[Budget],
[Event].[Spend],
COALESCE([Event].[FundsRaised-Cash], 0) + COALESCE([Event].[FundsRaised-Electronic], 0) AS [FundsRaised], -- Fixed: no such column; combine Cash + Electronic
[Event].[Highlights],
[Event].[PlannedNumberAttendees],
[Event].[ActualNumberAttendees]
FROM [Event]
INNER JOIN [Category] ON [Event].[CategoryID] = [Category].[id]
INNER JOIN [EventCouncils] ON [Event].[id] = [EventCouncils].[EventID]
INNER JOIN [Council] ON [EventCouncils].[CouncilID] = [Council].[id] -- Fixed circular loop
INNER JOIN [Shift] ON [Event].[id] = [Shift].[EventID]
INNER JOIN [Member] AS [OwnerMember] ON [Event].[OwnerID] = [OwnerMember].[id]; -- Target clear single entity owner
GO
CREATE OR ALTER VIEW [view_EventSignups] AS
SELECT
[Council].[CouncilName],
[Council].[CouncilNumber],
[Event].[EventName],
[Member].[MemberNumber],
[Member].[MemberFirstName],
[Member].[MemberLastName],
[Shift].[ShiftName],
[Shift].[ShiftDate],
[Shift].[StartTime],
[Shift].[EndTime],
[EventSignup].[SignupNotes]
FROM [EventSignup]
INNER JOIN [Member] ON [EventSignup].[MemberID] = [Member].[id]
INNER JOIN [Shift] ON [EventSignup].[ShiftID] = [Shift].[id]
INNER JOIN [Event] ON [Shift].[EventID] = [Event].[id]
INNER JOIN [Council] ON [Member].[CouncilID] = [Council].[id];
GO
CREATE OR ALTER VIEW [view_EventTime] AS
SELECT
[Council].[CouncilNumber],
[Council].[CouncilName],
[Member].[MemberNumber],
[Member].[MemberFirstName],
[Event].[EventName],
[Shift].[ShiftName],
[Shift].[ShiftDate],
[EventTime].[Hours],
[EventTime].[ShiftNotes],
[Category].[Category]
FROM [EventTime]
INNER JOIN [Member] ON [EventTime].[MemberID] = [Member].[id]
INNER JOIN [Council] ON [Member].[CouncilID] = [Council].[id]
INNER JOIN [Shift] ON [EventTime].[ShiftID] = [Shift].[id]
INNER JOIN [Event] ON [Shift].[EventID] = [Event].[id]
INNER JOIN [Category] ON [Event].[CategoryID] = [Category].[id];
GO
CREATE OR ALTER VIEW [view_ActivityTime] AS
SELECT
[Council].[CouncilNumber],
[Council].[CouncilName],
[Member].[MemberNumber],
[Member].[MemberFirstName],
[Activities].[ActivityName],
[ActivityTime].[ActivityDate],
[ActivityTime].[Hours],
[ActivityTime].[ActivityNotes],
[Category].[Category]
FROM [ActivityTime]
INNER JOIN [Activities] ON [ActivityTime].[ActivityID] = [Activities].[id]
INNER JOIN [Member] ON [ActivityTime].[MemberID] = [Member].[id]
INNER JOIN [Council] ON [Member].[CouncilID] = [Council].[id]
INNER JOIN [Category] ON [Activities].[CategoryID] = [Category].[id];
GO
CREATE OR ALTER VIEW [view_NoShows] AS
SELECT
[Council].[CouncilNumber],
[Council].[CouncilName],
[Event].[EventName],
[Member].[MemberNumber],
[Member].[MemberFirstName],
[Shift].[ShiftName],
[Shift].[ShiftDate],
[NoShowReason].[NoShowReasonCode],
[NoShowReason].[NoShowReasonDescription]
FROM [EventSignup]
INNER JOIN [Shift] ON [EventSignup].[ShiftID] = [Shift].[id]
INNER JOIN [Member] ON [EventSignup].[MemberID] = [Member].[id]
LEFT OUTER JOIN [NoShowReason] ON [EventSignup].[NoShowReasonID] = [NoShowReason].[id] -- Sprint 5L: a no-show without a recorded reason must still be audited
INNER JOIN [Council] ON [Member].[CouncilID] = [Council].[id]
INNER JOIN [Event] ON [Shift].[EventID] = [Event].[id]
WHERE [EventSignup].[NoShow] = 1;
GO
CREATE OR ALTER VIEW [view_LessonsLearned] AS
SELECT
[Council].[CouncilNumber],
[Council].[CouncilName],
[Event].[EventName],
[Category].[Category],
[LessonsLearnedCategory].[LessonsLearnedCategory],
[LessonsLearned].[LessonsLearnedDescription]
FROM [LessonsLearned]
INNER JOIN [LessonsLearnedCategory] ON [LessonsLearned].[LeassonsLearnedCategoryID] = [LessonsLearnedCategory].[id]
INNER JOIN [Event] ON [LessonsLearned].[EventID] = [Event].[id]
INNER JOIN [EventCouncils] ON [Event].[id] = [EventCouncils].[EventID]
INNER JOIN [Council] ON [EventCouncils].[CouncilID] = [Council].[id]
INNER JOIN [Category] ON [Event].[CategoryID] = [Category].[id];
GO

-- PHASE 2 ADDITIONAL SCHEMA EXTENSIONS
CREATE TABLE [WorkingStatus] (
	[id] INTEGER NOT NULL IDENTITY,
	[WorkingStatus] VARCHAR(25) NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [Donation] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[DonationDate] DATE NOT NULL,
	[DonationMethodID] INTEGER NOT NULL,
	[DonationTypeID] INTEGER NOT NULL,
	[Donor] VARCHAR(100),
	[DonationDesciption] VARCHAR(255),
	[EventID] INTEGER, -- NULL for a standalone donation
	[DonationAmount] MONEY NOT NULL,
	[DonationPhotoURL] VARCHAR(255),
	[RecordedBy] INTEGER NULL, -- Sprint 5K audit: the member who recorded the donation; stamped once, never changed
	PRIMARY KEY([id])
);
GO

CREATE INDEX [Donation_EventID_idx]
ON [Donation] ([EventID]);
GO

CREATE INDEX [Donation_CouncilID_idx]
ON [Donation] ([CouncilID]);
GO

CREATE TABLE [DonationMethod] (
	[id] INTEGER NOT NULL IDENTITY,
	[DonationMethod] VARCHAR(30) NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [DonationType] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[DonationType] VARCHAR(100) NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [Skill] (
	[id] INTEGER NOT NULL IDENTITY,
	[SkillName] VARCHAR(30) NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [SkillLevel] (
	[id] INTEGER NOT NULL IDENTITY,
	[SkillLevel] VARCHAR(30) NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [MemberSkill] (
	[id] INTEGER NOT NULL IDENTITY,
	[SkillID] INTEGER NOT NULL,
	[SkillLevelID] INTEGER NOT NULL,
	[MemberID] INTEGER NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE INDEX [SkillMember_MemberID_idx]
ON [MemberSkill] ([MemberID]);
GO

CREATE TABLE [KOCTrainingClasses] (
	[id] INTEGER NOT NULL IDENTITY,
	[ClassName] VARCHAR(100) NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [MemberTraining] (
	[id] INTEGER NOT NULL IDENTITY,
	[MemberID] INTEGER NOT NULL,
	[TrainingClassID] INTEGER NOT NULL,
	[YearTaken] DATE NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE INDEX [MemberTraining_MemberID_idx]
ON [MemberTraining] ([MemberID]);
GO

CREATE TABLE [CouncilDonationMethod] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[DonationMethodID] INTEGER NOT NULL,
	[DonationMethodURL] VARCHAR(255),
	PRIMARY KEY([id])
);
GO

-- Feedback and bug reports members send from the portal's Online Help Center. Only Super Admins read them.
CREATE TABLE [SystemFeedback] (
	[id] INTEGER NOT NULL IDENTITY,
	[MemberID] INTEGER NOT NULL,
	[SubmittedAt] DATETIME NOT NULL DEFAULT getdate(),
	[FeedbackText] VARCHAR(2000) NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE INDEX [SystemFeedback_SubmittedAt_Idx]
ON [SystemFeedback] ([SubmittedAt]);
GO

ALTER TABLE [SystemFeedback]
ADD FOREIGN KEY([MemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO

ALTER TABLE [Member]
ADD FOREIGN KEY([WorkingStatusID])
REFERENCES [WorkingStatus]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [Donation]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [Donation]
ADD FOREIGN KEY([EventID])
REFERENCES [Event]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [Donation]
ADD FOREIGN KEY([DonationMethodID])
REFERENCES [DonationMethod]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [DonationType]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [Donation]
ADD FOREIGN KEY([DonationTypeID])
REFERENCES [DonationType]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [Donation]
ADD FOREIGN KEY([RecordedBy])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [MemberSkill]
ADD FOREIGN KEY([SkillID])
REFERENCES [Skill]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [MemberSkill]
ADD FOREIGN KEY([SkillLevelID])
REFERENCES [SkillLevel]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [MemberSkill]
ADD FOREIGN KEY([MemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [MemberTraining]
ADD FOREIGN KEY([TrainingClassID])
REFERENCES [KOCTrainingClasses]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [MemberTraining]
ADD FOREIGN KEY([MemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CouncilDonationMethod]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CouncilDonationMethod]
ADD FOREIGN KEY([DonationMethodID])
REFERENCES [DonationMethod]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO

CREATE OR ALTER VIEW [view_Donations] AS
SELECT
  [Council].[CouncilNumber],
  [Council].[CouncilName],
  [Donation].[DonationDate],
  [DonationMethod].[DonationMethod],
  [Donation].[DonationAmount],
  [Event].[EventName],
  [Donation].[Donor],
  [Donation].[DonationDesciption],
  [DonationType].[DonationType]
FROM [Donation]
INNER JOIN [Council] ON [Donation].[CouncilID] = [Council].[id]
LEFT OUTER JOIN [Event] ON [Donation].[EventID] = [Event].[id] -- standalone donations have no event
INNER JOIN [DonationMethod] ON [Donation].[DonationMethodID] = [DonationMethod].[id]
INNER JOIN [DonationType] ON [Donation].[DonationTypeID] = [DonationType].[id];
GO

CREATE OR ALTER VIEW [view_CouncilSkills] AS
SELECT
  [Council].[CouncilNumber],
  [Council].[CouncilName],
  [Skill].[SkillName],
  [SkillLevel].[SkillLevel],
  [Member].[MemberLastName],
  [Member].[MemberFirstName],
  [Member].[Phone],
  [Member].[Email]
FROM [MemberSkill]
INNER JOIN [Member] ON [MemberSkill].[MemberID] = [Member].[id]
INNER JOIN [Skill] ON [MemberSkill].[SkillID] = [Skill].[id]
INNER JOIN [SkillLevel] ON [MemberSkill].[SkillLevelID] = [SkillLevel].[id]
INNER JOIN [Council] ON [Member].[CouncilID] = [Council].[id];
GO

-- =========================================================================
-- 10. EXPENSE REPORTING (Sprint 5R)
-- Members file expense sheets (ExpenseReport) itemised by receipt (ExpenseLineItem);
-- council leadership approves them and pays approved sheets by check (ExpenseDisbursement).
-- ExpenseReport.Status runs Draft -> Submitted -> Approved -> Reimbursed; the shared rules layer
-- enforces the values and transitions, so there is no CHECK constraint here.
-- =========================================================================
CREATE TABLE [ExpenseDisbursement] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[CheckNumber] VARCHAR(50) NOT NULL,
	[PayoutDate] DATE NOT NULL,
	[TotalAmount] DECIMAL(18,2) NOT NULL, -- sum of the paid sheets' line items
	[Notes] TEXT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [ExpenseReport] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL, -- always the submitter's own council
	[SubmitterMemberID] INTEGER NOT NULL,
	[Status] VARCHAR(50) NOT NULL, -- Draft, Submitted, Approved, Reimbursed
	[LinkedEventID] INTEGER NULL,
	[LinkedMeetingID] INTEGER NULL,
	[DisbursementID] INTEGER NULL, -- set when the sheet is paid (Status = Reimbursed)
	[RejectionReason] VARCHAR(2000) NULL, -- Sprint 5R-1.5: why leadership returned it to Draft; cleared on resubmission
	PRIMARY KEY([id])
);
GO

CREATE TABLE [ExpenseLineItem] (
	[id] INTEGER NOT NULL IDENTITY,
	[ExpenseReportID] INTEGER NOT NULL,
	[DateOfExpense] DATE NOT NULL,
	[Amount] DECIMAL(18,2) NOT NULL,
	[VendorName] VARCHAR(255) NOT NULL,
	[ReceiptPhotoURL] VARCHAR(2000) NULL,
	[ExpenseDescription] TEXT NOT NULL,
	PRIMARY KEY([id])
);
GO

ALTER TABLE [ExpenseDisbursement]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [ExpenseReport]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [ExpenseReport]
ADD FOREIGN KEY([SubmitterMemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [ExpenseReport]
ADD FOREIGN KEY([LinkedEventID])
REFERENCES [Event]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [ExpenseReport]
ADD FOREIGN KEY([LinkedMeetingID])
REFERENCES [Meeting]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [ExpenseReport]
ADD FOREIGN KEY([DisbursementID])
REFERENCES [ExpenseDisbursement]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [ExpenseLineItem]
ADD FOREIGN KEY([ExpenseReportID])
REFERENCES [ExpenseReport]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO

CREATE INDEX [ExpenseReport_Submitter_Idx] ON [ExpenseReport] ([SubmitterMemberID]);
GO
CREATE INDEX [ExpenseReport_Council_Status_Idx] ON [ExpenseReport] ([CouncilID], [Status]);
GO
CREATE INDEX [ExpenseLineItem_Report_Idx] ON [ExpenseLineItem] ([ExpenseReportID]);
GO

-- =========================================================================
-- 11. PUSH NOTIFICATIONS AND SUPREME COUNCIL REPORTING (Sprint 5T)
-- NotificationLog keeps one row per alert per recipient, so every member can read back the alerts
-- sent to them. SupremeReportingSync records each push of compliance answers to an Alchemer survey
-- (AnnualSurvey = Form 1728, CouncilAudit = Form 1295). As with ExpenseReport.Status, the shared rules
-- layer enforces the Priority, FormType and Status values, so there are no CHECK constraints here.
-- SentAt and SyncDate are DATETIME: T-SQL's TIMESTAMP is a ROWVERSION counter, not a point in time.
-- =========================================================================
CREATE TABLE [NotificationLog] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL, -- the council whose leadership sent the alert
	[TargetMemberID] INTEGER NOT NULL,
	[Title] VARCHAR(100) NOT NULL,
	[MessageBody] VARCHAR(2000) NOT NULL,
	[Priority] VARCHAR(10) NOT NULL, -- Low, Medium, High
	[SentAt] DATETIME NOT NULL DEFAULT getdate(),
	[IsRead] BIT NOT NULL DEFAULT 0,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [SupremeReportingSync] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[FormType] VARCHAR(20) NOT NULL, -- AnnualSurvey, CouncilAudit
	[SyncDate] DATETIME NOT NULL DEFAULT getdate(),
	[SyncedByID] INTEGER NOT NULL,
	[AlchemerSurveyID] VARCHAR(100) NOT NULL,
	[Status] VARCHAR(10) NOT NULL, -- Success, Failed
	PRIMARY KEY([id])
);
GO

ALTER TABLE [NotificationLog]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [NotificationLog]
ADD FOREIGN KEY([TargetMemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [SupremeReportingSync]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [SupremeReportingSync]
ADD FOREIGN KEY([SyncedByID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO

CREATE INDEX [NotificationLog_Target_SentAt_Idx] ON [NotificationLog] ([TargetMemberID], [SentAt]);
GO
CREATE INDEX [SupremeReportingSync_Council_Idx] ON [SupremeReportingSync] ([CouncilID], [SyncDate]);
GO


-- =========================================================================
-- 12. OFFICER ELECTIONS AND LEADERSHIP HISTORY (Sprint 5U)
-- CouncilElectionBallot says which of a council's elected seats are open for nomination this cycle,
-- and whether a seat is up in a mid-year election after an abdication (open until NominationsCloseAt).
-- OfficerNominations holds one row per nominee per seat per term; FraternalYear ('2026-2027', July 1 -
-- June 30) is the term the election fills, so the same nominee may be put up again in a later year.
-- IsEligible = 0 marks a Grand Knight nominee who has never served as Deputy Grand Knight or Grand Knight.
-- CouncilLeadershipHistory holds one row per member per seat per term; a NULL EndDate is the sitting holder.
-- ExitReason is TermConcluded or Abdicated, enforced by the shared rules layer as elsewhere (no CHECK).
-- Roles are matched by name there (Grand Knight, Trustee 1-3, the appointed offices), never by id.
-- =========================================================================
CREATE TABLE [CouncilElectionBallot] (
	[CouncilID] INTEGER NOT NULL,
	[RoleID] INTEGER NOT NULL,
	[IsUpForElection] BIT NOT NULL DEFAULT 0,
	[IsMidYearElection] BIT NOT NULL DEFAULT 0,
	[NominationsCloseAt] DATETIME NULL, -- mid-year elections only: two weeks after the abdication
	PRIMARY KEY([CouncilID], [RoleID])
);
GO

CREATE TABLE [OfficerNominations] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[OfficeRoleID] INTEGER NOT NULL,
	[NomineeMemberID] INTEGER NOT NULL,
	[NominatedByMemberID] INTEGER NOT NULL,
	[NominatedAt] DATETIME NOT NULL DEFAULT getdate(),
	[FraternalYear] VARCHAR(9) NOT NULL, -- the term the election fills, e.g. '2027-2028'
	[IsEligible] BIT NOT NULL DEFAULT 1,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [CouncilLeadershipHistory] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[MemberID] INTEGER NOT NULL,
	[RoleID] INTEGER NOT NULL,
	[FraternalYear] VARCHAR(9) NOT NULL,
	[StartDate] DATE NOT NULL,
	[EndDate] DATE NULL, -- NULL while the member holds the seat
	[ExitReason] VARCHAR(50) NULL, -- TermConcluded, Abdicated
	[AppointedByID] INTEGER NULL, -- the Grand Knight or Super Admin who appointed the member; NULL when elected or backfilled
	PRIMARY KEY([id])
);
GO

ALTER TABLE [CouncilElectionBallot]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CouncilElectionBallot]
ADD FOREIGN KEY([RoleID])
REFERENCES [Role]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [OfficerNominations]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [OfficerNominations]
ADD FOREIGN KEY([OfficeRoleID])
REFERENCES [Role]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [OfficerNominations]
ADD FOREIGN KEY([NomineeMemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [OfficerNominations]
ADD FOREIGN KEY([NominatedByMemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CouncilLeadershipHistory]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CouncilLeadershipHistory]
ADD FOREIGN KEY([MemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CouncilLeadershipHistory]
ADD FOREIGN KEY([RoleID])
REFERENCES [Role]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CouncilLeadershipHistory]
ADD FOREIGN KEY([AppointedByID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO

CREATE UNIQUE INDEX [OfficerNominations_Council_Role_Nominee_Year_Idx] ON [OfficerNominations] ([CouncilID], [OfficeRoleID], [NomineeMemberID], [FraternalYear]);
GO
CREATE INDEX [CouncilLeadershipHistory_Council_Role_Idx] ON [CouncilLeadershipHistory] ([CouncilID], [RoleID], [EndDate]);
GO
CREATE INDEX [CouncilLeadershipHistory_Member_Idx] ON [CouncilLeadershipHistory] ([MemberID]);
GO


-- =========================================================================
-- 13. CHARITABLE GIVING AND DISBURSEMENTS (Sprint 5V)
-- GlobalCharityRegistry is one registry shared by every council; a charity is registered once (EIN is unique
-- when known, stored as 'NN-NNNNNNN') and councils connect to it through CouncilCharityLink. A member proposes a
-- gift in CharityDonationProposal (ProposedCharityName is free text, ExistingCharityID set when the member picked a
-- registry entry); a Financial Secretary or Treasurer settles it by paying a check into CharitableDisbursementLedger,
-- which the monthly summary counts as spend. Status ('Pending', 'Approved', 'Rejected') is enforced by the shared
-- rules layer as elsewhere (no CHECK). MeetingMinutesID is the council meeting whose minutes record the vote.
-- =========================================================================
CREATE TABLE [GlobalCharityRegistry] (
	[id] INTEGER NOT NULL IDENTITY,
	[Name] VARCHAR(255) NOT NULL,
	[Description] TEXT NOT NULL,
	[EIN] VARCHAR(20) NULL, -- IRS Employer Identification Number, 'NN-NNNNNNN'; unique when present
	[State] VARCHAR(2) NOT NULL, -- two-letter postal code, upper case
	[Phone] VARCHAR(50) NULL,
	[ContactName] VARCHAR(255) NULL,
	[ContactEmail] VARCHAR(255) NULL,
	[Address] VARCHAR(512) NULL,
	[ZipCode] VARCHAR(20) NULL,
	[IsCatholic] BIT NOT NULL DEFAULT 0,
	[CharityType] VARCHAR(100) NOT NULL,
	[IsAnnual] BIT NOT NULL DEFAULT 0, -- Sprint 5Y: councils give to it every fraternal year; seeds the next year's budget forecast
	PRIMARY KEY([id])
);
GO

CREATE TABLE [CouncilCharityLink] (
	[CouncilID] INTEGER NOT NULL,
	[CharityID] INTEGER NOT NULL,
	[ConnectedAt] DATETIME NOT NULL DEFAULT getdate(),
	PRIMARY KEY([CouncilID], [CharityID])
);
GO

CREATE TABLE [CharityDonationProposal] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[SubmitterMemberID] INTEGER NOT NULL,
	[ProposedCharityName] VARCHAR(255) NOT NULL,
	[ProposedAmount] DECIMAL(18,2) NOT NULL,
	[ExistingCharityID] INTEGER NULL, -- the registry entry, once the member or the paying officer names one
	[Status] VARCHAR(50) NOT NULL, -- Pending, Approved, Rejected
	[MeetingMinutesID] INTEGER NULL, -- the council meeting whose minutes record the vote
	[RejectionReason] VARCHAR(2000) NULL, -- Sprint 5V-2: why leadership rejected the proposal (charities.rejectProposal)
	PRIMARY KEY([id])
);
GO

CREATE TABLE [CharitableDisbursementLedger] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[CharityID] INTEGER NOT NULL,
	[Amount] DECIMAL(18,2) NOT NULL,
	[CheckNumber] VARCHAR(50) NOT NULL, -- unique per council across this ledger and ExpenseDisbursement (one checkbook)
	[DisbursedByID] INTEGER NOT NULL,
	[PayoutDate] DATE NOT NULL,
	[Notes] TEXT NULL,
	[ProposalID] INTEGER NULL, -- Sprint 5V-2: the proposal the check paid (audit trail)
	PRIMARY KEY([id])
);
GO

ALTER TABLE [CouncilCharityLink]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CouncilCharityLink]
ADD FOREIGN KEY([CharityID])
REFERENCES [GlobalCharityRegistry]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CharityDonationProposal]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CharityDonationProposal]
ADD FOREIGN KEY([SubmitterMemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CharityDonationProposal]
ADD FOREIGN KEY([ExistingCharityID])
REFERENCES [GlobalCharityRegistry]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CharityDonationProposal]
ADD FOREIGN KEY([MeetingMinutesID])
REFERENCES [Meeting]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CharitableDisbursementLedger]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CharitableDisbursementLedger]
ADD FOREIGN KEY([CharityID])
REFERENCES [GlobalCharityRegistry]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CharitableDisbursementLedger]
ADD FOREIGN KEY([DisbursedByID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO

-- Filtered: SQL Server treats NULLs as equal in a plain unique index, and many small charities have no EIN on file.
CREATE UNIQUE INDEX [GlobalCharityRegistry_EIN_Idx] ON [GlobalCharityRegistry] ([EIN]) WHERE [EIN] IS NOT NULL;
GO
CREATE INDEX [GlobalCharityRegistry_State_Name_Idx] ON [GlobalCharityRegistry] ([State], [Name]);
GO
CREATE INDEX [CouncilCharityLink_Charity_Idx] ON [CouncilCharityLink] ([CharityID]);
GO
CREATE INDEX [CharityDonationProposal_Council_Status_Idx] ON [CharityDonationProposal] ([CouncilID], [Status]);
GO
ALTER TABLE [CharitableDisbursementLedger]
ADD FOREIGN KEY([ProposalID])
REFERENCES [CharityDonationProposal]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO

CREATE INDEX [CharitableDisbursementLedger_Council_Payout_Idx] ON [CharitableDisbursementLedger] ([CouncilID], [PayoutDate]);
GO


-- =========================================================================
-- 14. ANNUAL BUDGET FORECASTING (Sprint 5Y)
-- One row per budget line of a council's fraternal year ('YYYY-YYYY', July 1 - June 30). budget.prePopulateNextYear
-- seeds PrePopulatedAmount from the previous year's actual spend: 'Event' rows from annual events (ReferenceSourceID =
-- Event.id), 'Donation' rows from checks paid to annual charities (ReferenceSourceID = GlobalCharityRegistry.id) and
-- the 'Operational' meetings row from expenses linked to council meetings. Council leadership proposes
-- ProposedBudgetAmount. Custom 'Operational' lines carry no ReferenceSourceID. ReferenceSourceID has no foreign key
-- because it points at a different table per CategoryType; CategoryType is enforced by the shared rules layer as
-- elsewhere (no CHECK).
-- Sprint 5Y-3: each council keeps its own budget categories (funds) in CouncilBudgetCategory, a council lookup table,
-- and a line is filed under one through BudgetCategoryID (NULL while uncategorized).
-- Sprint 5Y-4: budget lifecycle. BudgetStatus is 'Draft' (seeded, no figure proposed yet), 'Proposed' (leadership or
-- the Budget Director drafted ProposedBudgetAmount) or 'Approved'. ApprovedBudgetAmount stays 0.00 until
-- budget.approveAndFinalizeEntireBudget records the council's vote: in one transaction it copies every line's
-- ProposedBudgetAmount into ApprovedBudgetAmount and marks the whole year 'Approved', after which its figures are
-- frozen. BudgetStatus is enforced by the shared rules layer (no CHECK), like CategoryType.
-- =========================================================================
CREATE TABLE [CouncilBudgetCategory] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[CategoryName] VARCHAR(255) NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [CouncilBudgetForecast] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[FraternalYear] VARCHAR(9) NOT NULL, -- e.g. '2027-2028'
	[CategoryType] VARCHAR(50) NOT NULL, -- Event, Donation, Operational
	[ReferenceSourceID] INTEGER NULL, -- Event.id or GlobalCharityRegistry.id; NULL for Operational lines
	[LineItemName] VARCHAR(255) NOT NULL,
	[PrePopulatedAmount] DECIMAL(18,2) NOT NULL DEFAULT 0.00, -- the previous fraternal year's actual spend
	[ApprovedBudgetAmount] DECIMAL(18,2) NOT NULL DEFAULT 0.00, -- Sprint 5Y-4: the voted figure, set only on approval
	[Notes] TEXT NULL,
	[BudgetCategoryID] INTEGER NULL, -- Sprint 5Y-3: the council budget category (fund) the line is filed under
	[ProposedBudgetAmount] DECIMAL(18,2) NOT NULL DEFAULT 0.00, -- Sprint 5Y-4: the figure drafted May 1 - June 30
	[BudgetStatus] VARCHAR(20) NOT NULL, -- Sprint 5Y-4: Draft, Proposed, Approved (written by every insert, like ExpenseReport.Status)
	PRIMARY KEY([id])
);
GO

ALTER TABLE [CouncilBudgetCategory]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CouncilBudgetForecast]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CouncilBudgetForecast]
ADD FOREIGN KEY([BudgetCategoryID])
REFERENCES [CouncilBudgetCategory]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO

CREATE UNIQUE INDEX [CouncilBudgetCategory_Council_Name_Idx] ON [CouncilBudgetCategory] ([CouncilID], [CategoryName]);
GO

-- SQL Server treats NULL ReferenceSourceIDs as equal in this index and SQLite does not, so the drivers also refuse a
-- duplicate Operational line by name (BUDGET_LINE_EXISTS).
CREATE UNIQUE INDEX [CouncilBudgetForecast_Line_Idx] ON [CouncilBudgetForecast] ([CouncilID], [FraternalYear], [CategoryType], [ReferenceSourceID], [LineItemName]);
GO

-- =========================================================================
-- Sprint 5Y-5: COUNCIL MEETING TYPES AND AGENDA TEMPLATES
-- Each council keeps its own meeting types in CouncilMeetingType, a council lookup table isolated per council by the
-- (CouncilID, TypeName) index; Meeting.MeetingTypeID files a meeting under one (NULL while unfiled; the older
-- Meeting.MeetingType still points at the global MeetingType lookup). CouncilAgendaTemplate holds at most one agenda
-- outline per council and meeting type. MeetingInvites.ResponseStatus records the invitee's RSVP: NoResponse,
-- Accepted or Declined, enforced by the shared rules layer (no CHECK).
-- =========================================================================
CREATE TABLE [CouncilMeetingType] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[TypeName] VARCHAR(100) NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [CouncilAgendaTemplate] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[MeetingTypeID] INTEGER NOT NULL,
	[TemplateText] TEXT NOT NULL,
	PRIMARY KEY([id])
);
GO

ALTER TABLE [CouncilMeetingType]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CouncilAgendaTemplate]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CouncilAgendaTemplate]
ADD FOREIGN KEY([MeetingTypeID])
REFERENCES [CouncilMeetingType]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [Meeting]
ADD FOREIGN KEY([MeetingTypeID])
REFERENCES [CouncilMeetingType]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO

CREATE UNIQUE INDEX [CouncilMeetingType_Council_TypeName_Idx] ON [CouncilMeetingType] ([CouncilID], [TypeName]);
GO

CREATE UNIQUE INDEX [CouncilAgendaTemplate_Council_MeetingType_Idx] ON [CouncilAgendaTemplate] ([CouncilID], [MeetingTypeID]);
GO

-- =========================================================================
-- Sprint 5Z-1: NORMALIZED CHARITABLE INTAKE AND COUNCIL MISSION AREAS
-- CouncilRelationshipType and CouncilMissionArea are council lookup tables, isolated per council by their
-- (CouncilID, Name) indexes. CharitableRequest is the Knight Shepherd's intake form for an outside organization
-- asking the council for money: the Shepherd (the member who carries the request) submits it into the council's
-- shared vetting queue, an independent officer or Trustee claims and vets it, and it is advanced to the council's
-- vote. RequestStatus runs Submitted -> Claimed by Trustee -> Advanced; VoteStatus records the council's vote
-- (Pending until voted). Both are enforced by the shared rules layer (no CHECK). Event.MissionAreaID and
-- Meeting.MissionAreaID file an event or meeting under one of the council's mission areas (NULL while unfiled).
-- Sprint 5Z-Member-Charity rule (no structural change; schema version stays 29): requests enter only through the
-- members-only Propose Charity Grant page, never a public form; ShepherdMemberID is always the signed-in member who
-- saves it. Saving MUST dispatch the Shepherd's 3-step tracking notice (Vetting -> Presentation -> Disbursement) to
-- that member, and the Trustees' status-report prompt falls CHARITABLE_TRUSTEE_FOLLOWUP_MONTHS (6) months after
-- SubmittedAt (charitableTrusteeFollowUpDate). RequestTier is set by the vetter; the form no longer offers it.
-- =========================================================================
CREATE TABLE [CouncilRelationshipType] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[RelationshipName] VARCHAR(100) NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [CouncilMissionArea] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[MissionAreaName] VARCHAR(100) NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [CharitableRequest] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[OrganizationName] VARCHAR(255) NOT NULL,
	[ContactName] VARCHAR(255) NULL,
	[ContactPhone] VARCHAR(50) NULL,
	[ContactEmail] VARCHAR(255) NULL,
	[AmountRequested] DECIMAL(18,2) NOT NULL,
	[RequestStatus] VARCHAR(50) NOT NULL DEFAULT 'Submitted', -- Submitted, Claimed by Trustee, Advanced; Declined (Sprint 5Z-2)
	[SubmittedAt] DATETIME NOT NULL DEFAULT getdate(),
	PRIMARY KEY([id])
);
GO

-- The intake and vetting form's process variables.
ALTER TABLE [CharitableRequest] ADD [ShepherdMemberID] INTEGER NOT NULL DEFAULT 0;
GO
ALTER TABLE [CharitableRequest] ADD [MailingAddress] TEXT NULL;
GO
ALTER TABLE [CharitableRequest] ADD [RelationshipTypeID] INTEGER NULL;
GO
ALTER TABLE [CharitableRequest] ADD [Is501c3] BIT NOT NULL DEFAULT 0;
GO
ALTER TABLE [CharitableRequest] ADD [EIN] VARCHAR(50) NULL;
GO
ALTER TABLE [CharitableRequest] ADD [Website] VARCHAR(255) NULL;
GO
ALTER TABLE [CharitableRequest] ADD [OrgMission] TEXT NULL;
GO
ALTER TABLE [CharitableRequest] ADD [IsRecurring] BIT NOT NULL DEFAULT 0;
GO
ALTER TABLE [CharitableRequest] ADD [FundsNeededBy] DATETIME NULL;
GO
ALTER TABLE [CharitableRequest] ADD [SpecificUse] TEXT NULL;
GO
ALTER TABLE [CharitableRequest] ADD [TargetBeneficiary] TEXT NULL;
GO
ALTER TABLE [CharitableRequest] ADD [AccountabilityPlan] TEXT NULL;
GO
ALTER TABLE [CharitableRequest] ADD [RequestTier] INTEGER NOT NULL DEFAULT 1;
GO
ALTER TABLE [CharitableRequest] ADD [VetterMemberID] INTEGER NULL;
GO
ALTER TABLE [CharitableRequest] ADD [VettingNotes] TEXT NULL;
GO
ALTER TABLE [CharitableRequest] ADD [VettedDate] DATETIME NULL;
GO
ALTER TABLE [CharitableRequest] ADD [MoverMemberID] INTEGER NULL;
GO
ALTER TABLE [CharitableRequest] ADD [SeconderMemberID] INTEGER NULL;
GO
ALTER TABLE [CharitableRequest] ADD [VoteStatus] VARCHAR(50) NOT NULL DEFAULT 'Pending';
GO
ALTER TABLE [CharitableRequest] ADD [AmountApproved] DECIMAL(18,2) NOT NULL DEFAULT 0.00;
GO
ALTER TABLE [CharitableRequest] ADD [PaymentOrderId] INTEGER NULL;
GO

ALTER TABLE [Event] ADD [MissionAreaID] INTEGER NULL;
GO
ALTER TABLE [Meeting] ADD [MissionAreaID] INTEGER NULL;
GO

ALTER TABLE [CouncilRelationshipType]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CouncilMissionArea]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CharitableRequest]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CharitableRequest]
ADD FOREIGN KEY([ShepherdMemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CharitableRequest]
ADD FOREIGN KEY([RelationshipTypeID])
REFERENCES [CouncilRelationshipType]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CharitableRequest]
ADD FOREIGN KEY([VetterMemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CharitableRequest]
ADD FOREIGN KEY([MoverMemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CharitableRequest]
ADD FOREIGN KEY([SeconderMemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CharitableRequest]
ADD FOREIGN KEY([PaymentOrderId])
REFERENCES [CharitableDisbursementLedger]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [Event]
ADD FOREIGN KEY([MissionAreaID])
REFERENCES [CouncilMissionArea]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [Meeting]
ADD FOREIGN KEY([MissionAreaID])
REFERENCES [CouncilMissionArea]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO

CREATE UNIQUE INDEX [CouncilRelationshipType_Council_Name_Idx] ON [CouncilRelationshipType] ([CouncilID], [RelationshipName]);
GO
CREATE UNIQUE INDEX [CouncilMissionArea_Council_Name_Idx] ON [CouncilMissionArea] ([CouncilID], [MissionAreaName]);
GO
CREATE INDEX [CharitableRequest_Council_Status_Idx] ON [CharitableRequest] ([CouncilID], [RequestStatus]);
GO

-- =========================================================================
-- Sprint 5Z-2: CHARITABLE REQUEST MISSION AREA, TARGET BUDGET LINE AND DECLINE
-- The intake form files a request under one of the council's mission areas (MissionAreaID), and the vetter names the
-- budget line the gift would come out of (TargetBudgetLineID, a CouncilBudgetForecast row of the same council). A
-- claimed request may now end in 'Declined' instead of 'Advanced' (RequestStatus, enforced by the shared rules layer).
-- =========================================================================
ALTER TABLE [CharitableRequest] ADD [MissionAreaID] INTEGER NULL;
GO
ALTER TABLE [CharitableRequest] ADD [TargetBudgetLineID] INTEGER NULL;
GO
ALTER TABLE [CharitableRequest]
ADD FOREIGN KEY([MissionAreaID])
REFERENCES [CouncilMissionArea]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CharitableRequest]
ADD FOREIGN KEY([TargetBudgetLineID])
REFERENCES [CouncilBudgetForecast]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO

-- =========================================================================
-- Sprint 5Z-3: EXPENSE REPORT DUAL APPROVAL
-- A submitted sheet now needs two signatures before it reaches the Treasurer's disbursement desk. The Financial
-- Secretary audits it and issues the written order (FinancialSecretaryMemberID / FinancialSecretaryApprovedAt); the
-- Grand Knight then counter-signs (GrandKnightMemberID / GrandKnightApprovedAt), which moves Status to 'Approved'.
-- Both signatures are cleared when leadership returns the sheet to Draft. The shared rules layer enforces the order,
-- the signers' seats and that the two signers are different people.
-- =========================================================================
ALTER TABLE [ExpenseReport] ADD [FinancialSecretaryMemberID] INTEGER NULL;
GO
ALTER TABLE [ExpenseReport] ADD [FinancialSecretaryApprovedAt] DATETIME NULL;
GO
ALTER TABLE [ExpenseReport] ADD [GrandKnightMemberID] INTEGER NULL;
GO
ALTER TABLE [ExpenseReport] ADD [GrandKnightApprovedAt] DATETIME NULL;
GO
ALTER TABLE [ExpenseReport]
ADD FOREIGN KEY([FinancialSecretaryMemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [ExpenseReport]
ADD FOREIGN KEY([GrandKnightMemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO

-- =========================================================================
-- Sprint 5Z-5: PARLIAMENTARY CADENCE AND PROPOSED MOTIONS
-- CouncilCadenceConfig holds a council's standing recurrence rule for one of its own meeting types (at most one per
-- council and type): the CadencePattern ('First Tuesday' ... 'Fourth Saturday', or 'Last Thursday'), the default
-- 24-hour start time and the default location. meetings.populateAnnualCadence expands it into the twelve meetings of a
-- fraternal year (July through June). ProposedMotion is a meeting's list of motions to be put to the floor: SourceType
-- names where a motion came from ('CharitableRequest' or 'GeneralMember') and SourceRecordID the originating row
-- (a CharitableRequest id; NULL for a member's own motion, so it carries no foreign key). VoteResult stays 'Pending'
-- until the council votes. Both value lists are enforced by the shared rules layer (no CHECK).
-- =========================================================================
CREATE TABLE [CouncilCadenceConfig] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[MeetingTypeID] INTEGER NOT NULL,
	[CadencePattern] VARCHAR(100) NOT NULL,
	[DefaultStartTime] VARCHAR(50) NOT NULL,
	[DefaultLocation] TEXT NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [ProposedMotion] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[TargetMeetingID] INTEGER NOT NULL,
	[SourceType] VARCHAR(50) NOT NULL,
	[SourceRecordID] INTEGER NULL,
	[MotionText] TEXT NOT NULL,
	[PresenterMemberID] INTEGER NOT NULL,
	[AllocatedMinutes] INTEGER NOT NULL DEFAULT 5,
	[VoteResult] VARCHAR(50) NOT NULL DEFAULT 'Pending',
	PRIMARY KEY([id])
);
GO

ALTER TABLE [CouncilCadenceConfig]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [CouncilCadenceConfig]
ADD FOREIGN KEY([MeetingTypeID])
REFERENCES [CouncilMeetingType]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [ProposedMotion]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [ProposedMotion]
ADD FOREIGN KEY([TargetMeetingID])
REFERENCES [Meeting]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [ProposedMotion]
ADD FOREIGN KEY([PresenterMemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO

CREATE UNIQUE INDEX [CouncilCadenceConfig_Council_MeetingType_Idx] ON [CouncilCadenceConfig] ([CouncilID], [MeetingTypeID]);
GO
CREATE INDEX [ProposedMotion_Meeting_Idx] ON [ProposedMotion] ([TargetMeetingID]);
GO

-- =========================================================================
-- Sprint 5Z-6: DRIP-RELEASE INVITATIONS AND CADENCE RECIPIENTS
-- Meeting.InviteReleaseDate holds a meeting's invitations back from members' own feeds until that day: the invitation
-- rows exist from the start (so the meeting's managers see who will be invited), but listUpcoming for a member,
-- listSchedules and rsvpToInvite ignore them before it. NULL means released at once (every hand-scheduled meeting).
-- meetings.populateAnnualCadence sets it to five calendar days before the meeting's Date. CouncilCadenceConfig.
-- DefaultRecipientGroup names who those meetings invite: 'all_members', 'active_officers' or 'none' (rules layer, no
-- CHECK).
-- =========================================================================
ALTER TABLE [Meeting] ADD [InviteReleaseDate] DATE NULL;
GO
ALTER TABLE [CouncilCadenceConfig] ADD [DefaultRecipientGroup] VARCHAR(50) NOT NULL DEFAULT 'all_members';
GO

-- =========================================================================
-- Sprint 5Z-7: DOUBLE-ENTRY GENERAL LEDGER AND BALANCE SHEET
-- GLAccount is a council's chart of accounts: one row per account, AccountType 'Asset', 'Liability', 'Equity',
-- 'Revenue' or 'Expense' (GL_ACCOUNT_TYPES; rules layer, no CHECK). ParentAccountID nests an account under another of
-- the same council. A virtual goal (IsVirtualGoal = 1) is an earmark inside its parent asset account, saving toward
-- TargetGoalAmount; money moved into it is still held by the parent's bank account. JournalEntry is one line of a
-- posted transaction: exactly one of DebitAmount and CreditAmount is above zero. finance.logDoubleEntryTransaction
-- posts a transaction's lines together, and only when its debits equal its credits to the cent, so the ledger always
-- balances. IsBankReconciled is set by finance.uploadBankStatementReconciliation when a bank statement row matches.
-- Event.IntakeSessionStatus ('Inactive' or 'Active'; EVENT_INTAKE_SESSION_STATUSES, rules layer) gates the phone's
-- high-speed intake screens for an event.
-- =========================================================================
CREATE TABLE [GLAccount] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[AccountName] VARCHAR(100) NOT NULL,
	[AccountType] VARCHAR(50) NOT NULL,
	[ParentAccountID] INTEGER NULL,
	[IsVirtualGoal] BIT NOT NULL DEFAULT 0,
	[TargetGoalAmount] DECIMAL(18,2) NOT NULL DEFAULT 0.00,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [JournalEntry] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[GLAccountID] INTEGER NOT NULL,
	[DateLogged] DATETIME NOT NULL,
	[Description] TEXT NOT NULL,
	[DebitAmount] DECIMAL(18,2) NOT NULL DEFAULT 0.00,
	[CreditAmount] DECIMAL(18,2) NOT NULL DEFAULT 0.00,
	[LinkedEventID] INTEGER NULL,
	[LinkedMeetingID] INTEGER NULL,
	[IsBankReconciled] BIT NOT NULL DEFAULT 0,
	[CheckNumber] VARCHAR(50) NULL,
	PRIMARY KEY([id])
);
GO

ALTER TABLE [GLAccount]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [GLAccount]
ADD FOREIGN KEY([ParentAccountID])
REFERENCES [GLAccount]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [JournalEntry]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [JournalEntry]
ADD FOREIGN KEY([GLAccountID])
REFERENCES [GLAccount]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [JournalEntry]
ADD FOREIGN KEY([LinkedEventID])
REFERENCES [Event]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [JournalEntry]
ADD FOREIGN KEY([LinkedMeetingID])
REFERENCES [Meeting]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO

CREATE UNIQUE INDEX [GLAccount_Council_Name_Idx] ON [GLAccount] ([CouncilID], [AccountName]);
GO
CREATE INDEX [JournalEntry_Council_Account_Idx] ON [JournalEntry] ([CouncilID], [GLAccountID]);
GO
CREATE INDEX [JournalEntry_Council_Reconciled_Idx] ON [JournalEntry] ([CouncilID], [IsBankReconciled]);
GO

ALTER TABLE [Event] ADD [IntakeSessionStatus] VARCHAR(50) NOT NULL DEFAULT 'Inactive';
GO

-- =========================================================================
-- Sprint 5Z-8: TRANSACTION GROUPING
-- JournalEntry.TransactionID ties together the lines of one posting: finance.logDoubleEntryTransaction and
-- finance.transferAssetFunds stamp every line they write with one freshly generated UUID (36 characters), so a
-- posting can be read, shown and later reversed as a unit. The table is empty when the column is added, so it needs
-- no default.
-- =========================================================================
ALTER TABLE [JournalEntry] ADD [TransactionID] VARCHAR(50) NOT NULL;
GO
CREATE INDEX [JournalEntry_Transaction_Idx] ON [JournalEntry] ([TransactionID]);
GO

-- =========================================================================
-- Sprint 5Z-9: LIVE MEETING MANAGEMENT AND SMARTPHONE BALLOTING
-- A meeting's chair runs it live from the console: IsLiveInProgress marks it under way, ActiveAgendaItemName and
-- ActiveAgendaItemTimeRemaining (the minutes allotted to the item) are the topic on the center bar, and
-- ActiveAgendaItemStartedAt is when that item began, so every phone counts down from the same moment.
-- LiveQuorumRosterCount locks the council's Active roster count when the console starts, for the quorum check.
-- LiveAttendance is the live check-in roster (one row per member and meeting): a member checked in may vote whatever
-- they answered to the invitation. ProposedMotion.BallotOpenedAt marks a motion's smartphone ballot open (while its
-- VoteResult is still 'Pending'). BallotVote holds the secret ballots: AnonymousBallotHash is a keyed SHA-256 of the
-- motion and the voter under a secret kept outside the database, so the table never names a voter yet a second vote
-- from the same member collides on the unique index. VoteSelection is 'Approve', 'Deny' or 'Abstain'
-- (BALLOT_SELECTIONS; rules layer, no CHECK).
-- =========================================================================
ALTER TABLE [Meeting] ADD [ActiveAgendaItemName] VARCHAR(255) NULL;
GO
ALTER TABLE [Meeting] ADD [ActiveAgendaItemTimeRemaining] INTEGER NULL;
GO
ALTER TABLE [Meeting] ADD [IsLiveInProgress] BIT NOT NULL DEFAULT 0;
GO
ALTER TABLE [Meeting] ADD [ActiveAgendaItemStartedAt] DATETIME NULL;
GO
ALTER TABLE [Meeting] ADD [LiveQuorumRosterCount] INTEGER NULL;
GO
ALTER TABLE [ProposedMotion] ADD [BallotOpenedAt] DATETIME NULL;
GO

CREATE TABLE [LiveAttendance] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[MeetingID] INTEGER NOT NULL,
	[MemberID] INTEGER NOT NULL,
	[CheckedInAt] DATETIME NOT NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [BallotVote] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[ProposedMotionID] INTEGER NOT NULL,
	[AnonymousBallotHash] VARCHAR(255) NOT NULL,
	[VoteSelection] VARCHAR(50) NOT NULL,
	[CastAt] DATETIME NOT NULL,
	PRIMARY KEY([id])
);
GO

ALTER TABLE [LiveAttendance]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [LiveAttendance]
ADD FOREIGN KEY([MeetingID])
REFERENCES [Meeting]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [LiveAttendance]
ADD FOREIGN KEY([MemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [BallotVote]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [BallotVote]
ADD FOREIGN KEY([ProposedMotionID])
REFERENCES [ProposedMotion]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO

CREATE UNIQUE INDEX [LiveAttendance_Meeting_Member_Idx] ON [LiveAttendance] ([MeetingID], [MemberID]);
GO
CREATE UNIQUE INDEX [BallotVote_Motion_Hash_Idx] ON [BallotVote] ([ProposedMotionID], [AnonymousBallotHash]);
GO

-- =========================================================================
-- Sprint 5Z-10.8: PERSONAL DISTRIBUTION LISTS
-- DistributionLists.IsCouncilWide splits the council's public lists, which its Admins (and Super Admins) keep, from a
-- member's private segments: any Active member may build lists of fellow members for their own use, seen and changed
-- by their creator (CreatedBy) alone. Lists made before this sprint were all built by Admins, so they stay council-wide
-- (DEFAULT 1); distributionLists.create makes a private list unless an Admin asks for a council-wide one.
-- =========================================================================
ALTER TABLE [DistributionLists] ADD [IsCouncilWide] BIT NOT NULL DEFAULT 1;
GO

-- =========================================================================
-- Sprint 6A: COUNCIL FEATURE FLAGS
-- Five on/off switches on the council row that trim the portal and the phone app down to the financial engine and simple
-- service logs. A flag at 0 hides its module's sidebar links, pages, phone tabs and buttons for every member of the
-- council (portalAreas, mobileTabEnabled); the data stays and returns when the flag is set back to 1.
--   flag_mobile_elections     officer nominations and the appointed leadership matrix
--   flag_fundraising_inflow   public capital intake: the recorded donations desk and the phone's Donate tab (event
--                             point-of-sale grid, card and QR collections, gate intake drawers for parking, breakfasts,
--                             bingo and the like)
--   flag_charity_proposals    members' charity grant proposals and the vetting desk that tracks their progress
--   flag_complex_shifts       the event planner, shift sign-ups and shift hour reports
--   flag_meeting_management   the meeting center, cadence manager, live console and the phone's Meetings tab
-- Only a Super Admin changes them (councils.setFeatureFlags). Every existing council keeps every module (DEFAULT 1).
-- =========================================================================
ALTER TABLE [Council] ADD [flag_mobile_elections] BIT NOT NULL DEFAULT 1;
GO
ALTER TABLE [Council] ADD [flag_fundraising_inflow] BIT NOT NULL DEFAULT 1;
GO
ALTER TABLE [Council] ADD [flag_charity_proposals] BIT NOT NULL DEFAULT 1;
GO
ALTER TABLE [Council] ADD [flag_complex_shifts] BIT NOT NULL DEFAULT 1;
GO
ALTER TABLE [Council] ADD [flag_meeting_management] BIT NOT NULL DEFAULT 1;
GO

-- =========================================================================
-- Sprint 6B: ST. MARY'S PARLIAMENTARY ENGINE - EDITABLE LIVE AGENDA AND HAND-VOTE TALLIES
-- MeetingAgendaItem is one line of a meeting's structured agenda, as the live console displays it. SectionKey places it
-- under one of the St. Mary's agenda headings ('opening', 'officer_reports', 'director_reports', 'new_business',
-- 'old_business', 'upcoming_events', 'good_of_order'; AGENDA_SECTION_KEYS, rules layer, no CHECK) in SortOrder.
-- LineMarkdown is the line itself in light markdown (**bold**, *italic*, '- ' bullets); the Grand Knight or the Recorder
-- corrects it live from the console. The speaker is looked up when the agenda is read, never copied: SpeakerMemberID
-- names one member; otherwise SpeakerRoleID names a seat, shown as whoever holds it now in the meeting's council (the
-- most recently seated Active holder); SpeakerLabel is the printed fallback for a guest or a vacant seat ("State Deputy",
-- "Monsignor"). The New Business, Old Business and Upcoming Events blocks also list the meeting's motions and the
-- council's coming events straight from ProposedMotion and Event; a line correction on one of those is stored as an
-- item carrying ProposedMotionID or LinkedEventID, which then replaces the generated text.
-- MotionHandTally is the Recorder's count of a show of hands on a motion (one per motion): ApprovedCount and
-- DeniedCount decide it (more Approved than Denied passes; a tie fails) and write ProposedMotion.VoteResult in the same
-- transaction. LinkedTransactionID ties a motion that releases capital to its posting in the general ledger
-- (JournalEntry.TransactionID of the same council); it carries no foreign key because TransactionID is not unique.
-- =========================================================================
CREATE TABLE [MeetingAgendaItem] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[MeetingID] INTEGER NOT NULL,
	[SectionKey] VARCHAR(50) NOT NULL,
	[SortOrder] INTEGER NOT NULL DEFAULT 0,
	[LineMarkdown] TEXT NOT NULL,
	[SpeakerRoleID] INTEGER NULL,
	[SpeakerMemberID] INTEGER NULL,
	[SpeakerLabel] VARCHAR(100) NULL,
	[ProposedMotionID] INTEGER NULL,
	[LinkedEventID] INTEGER NULL,
	[LastEditedByMemberID] INTEGER NULL,
	[LastEditedAt] DATETIME NULL,
	PRIMARY KEY([id])
);
GO

CREATE TABLE [MotionHandTally] (
	[id] INTEGER NOT NULL IDENTITY,
	[CouncilID] INTEGER NOT NULL,
	[ProposedMotionID] INTEGER NOT NULL,
	[ApprovedCount] INTEGER NOT NULL,
	[DeniedCount] INTEGER NOT NULL,
	[RecordedByMemberID] INTEGER NOT NULL,
	[RecordedAt] DATETIME NOT NULL,
	[LinkedTransactionID] VARCHAR(50) NULL,
	PRIMARY KEY([id])
);
GO

ALTER TABLE [MeetingAgendaItem]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [MeetingAgendaItem]
ADD FOREIGN KEY([MeetingID])
REFERENCES [Meeting]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [MeetingAgendaItem]
ADD FOREIGN KEY([SpeakerRoleID])
REFERENCES [Role]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [MeetingAgendaItem]
ADD FOREIGN KEY([SpeakerMemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [MeetingAgendaItem]
ADD FOREIGN KEY([ProposedMotionID])
REFERENCES [ProposedMotion]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [MeetingAgendaItem]
ADD FOREIGN KEY([LinkedEventID])
REFERENCES [Event]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [MeetingAgendaItem]
ADD FOREIGN KEY([LastEditedByMemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [MotionHandTally]
ADD FOREIGN KEY([CouncilID])
REFERENCES [Council]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [MotionHandTally]
ADD FOREIGN KEY([ProposedMotionID])
REFERENCES [ProposedMotion]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO
ALTER TABLE [MotionHandTally]
ADD FOREIGN KEY([RecordedByMemberID])
REFERENCES [Member]([id])
ON UPDATE NO ACTION ON DELETE NO ACTION;
GO

CREATE INDEX [MeetingAgendaItem_Meeting_Idx] ON [MeetingAgendaItem] ([MeetingID], [SectionKey], [SortOrder]);
GO
CREATE UNIQUE INDEX [MotionHandTally_Motion_Idx] ON [MotionHandTally] ([ProposedMotionID]);
GO
