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
INNER JOIN [NoShowReason] ON [EventSignup].[NoShowReasonID] = [NoShowReason].[id]
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
