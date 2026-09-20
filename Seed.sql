-- =========================================================================
-- KNIGHTS OF COLUMBUS LOOKUP DATA SEED SCRIPT
-- Optimized for clean, multi-row execution in both Azure SQL and SQLite
-- =========================================================================

-- 1. Category Data Load 
INSERT INTO [Category] ([Category], [CategoryDescription])
VALUES
('Fellowship', 'Social Knights events'),
('Service', 'Providing help to parish, parishioners or community'),
('Faith Building', 'Events focussed on increasing the faith or Knights and/or parishioners'),
('Parish Community', 'Events that involve parishioners in getting to know each other better or contributing to the parish'),
('Fundraising', 'Generating income/donations for Knights council or parish'),
('Evangelization', 'Promoting Catholic faith to non-Catholics');
GO

-- 2. Degree Data Load 
INSERT INTO [Degree] ([Degree])
VALUES
('First'),
('Second'),
('Third'),
('Fourth');
GO

-- 3. Role Data Load 
INSERT INTO [Role] ([Role], [Officer])
VALUES
('Grand Knight', 1),
('Deputy Grand Knight', 1),
('Chancellor', 1),
('Recorder', 1),
('Financial Secretary', 1),
('Treasurer', 1),
('Warden', 1),
('Advocate', 1),
('Inside Guard', 1),
('Outside Guard', 1),
('Lector', 0),
('Trustee 1', 1),
('Trustee 2', 1),
('Trustee 3', 1),
('Membership Director', 0),
('Community Director', 0),
('Program Director', 0),
('Family Director', 0),
('Priest', 0),
('Member', 0);
GO

-- 4. Member Type Data Load
INSERT INTO [MemberType] ([Type])
VALUES
('Super Admin'),
('Admin'),
('Member');
GO

-- 5. Member Status Data Load
INSERT INTO [MemberStatus] ([Status])
VALUES
('Active'),
('Inactive'),
('Former'),
('Deceased');
GO

-- 6. No Show Reason Data Load 
INSERT INTO [NoShowReason] ([NoShowReasonCode], [NoShowReasonDescription])
VALUES
('A', 'Something came up'),
('B', 'Went to wrong location'),
('C', 'Had the wrong date'),
('D', 'Had the wrong time'),
('E', 'Forgot');
GO

-- 7. Lessons Learned Category Data Load 
INSERT INTO [LessonsLearnedCategory] ([LessonsLearnedCategory])
VALUES
('Planning'),
('Budgeting'),
('Scheduling'),
('Marketing'),
('Execution');
GO

-- 8. Meeting Type Data Load
INSERT INTO [MeetingType] ([Type],[Description])
VALUES 
('Monthly','Regular monthly meetings'),
('Officer','Meeting of all officers'),
('Community','Community committee meeting')
GO
-- =========================================================================
-- ADDITIONAL SPRINT SEEDING: COUNCILS, CREDENTIALS, AND ROLES
-- Adds testadmin, testsuperadmin, and testmember profiles with password: koc15295
-- =========================================================================

-- 1. Create a Default Baseline Council for Testing
INSERT INTO [Council] ([CouncilNumber], [CouncilName], [State], [Phone])
VALUES (15295, 'St. Jude Council', 'OR', '503-555-0199');
GO

-- 2. Create the Login Credentials (Passwords should be encrypted in production, plain for dev stub)
INSERT INTO [Credentials] ([Username], [Password])
VALUES 
('testsuperadmin@kofc.org', 'koc15295'), -- ID 1
('testadmin@kofc.org', 'koc15295'),      -- ID 2
('testmember@kofc.org', 'koc15295');     -- ID 3
GO

-- 3. Create Corresponding Member Profiles linking to those Credentials
-- Profiles use StatusID=1 (Active), DegreeID=3 (Third), MemberTypeIDs map to privileges
INSERT INTO [Member] (
    [CouncilID], [MemberNumber], [MemberFirstName], [MemberLastName], 
    [Phone], [StreetAddress1], [City], [State], [ZipCode], [Email], 
    [DateOfBirth], [StatusID], [DegreeID], [MemberTypeID], [CredentialID]
)
VALUES 
(1, 9900001, 'Super', 'Admin', '555-111-2222', '123 Global Way', 'Portland', 'OR', '97201', 'testsuperadmin@kofc.org', '1980-01-01', 1, 3, 1, 1),
(1, 9900002, 'Council', 'Admin', '555-333-4444', '456 Local Lane', 'Portland', 'OR', '97205', 'testadmin@kofc.org', '1985-05-05', 1, 3, 2, 2),
(1, 9900003, 'Brother', 'Knight', '555-666-7777', '789 Fraternal Rd', 'Portland', 'OR', '97210', 'testmember@kofc.org', '1990-10-10', 1, 3, 3, 3);
GO

-- 4. Assign Fraternal Roles to the Members (Grand Knight, Financial Sec, and Member)
INSERT INTO [MemberRoles] ([RoleID], [MemberID])
VALUES 
(1, 1),  -- Super Admin is set as Grand Knight locally
(5, 2),  -- Admin is set as Financial Secretary
(20, 3); -- Member is set as standard Member (Role id 20; there is no id 21)
GO

