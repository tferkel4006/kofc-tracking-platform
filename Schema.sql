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
	PRIMARY KEY([id])
);
GO

CREATE TABLE [MeetingInvites] (
	[id] INTEGER NOT NULL IDENTITY,
	[MeetingID] INTEGER,
	[MemberID] INTEGER,
	[Attended] BIT DEFAULT 0,
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
