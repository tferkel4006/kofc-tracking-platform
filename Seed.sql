-- =========================================================================
-- KNIGHTS OF COLUMBUS LOOKUP DATA SEED SCRIPT
-- Optimized for clean, multi-row execution in both Azure SQL and SQLite
-- =========================================================================

-- 1. Category Data Load 
-- Sprint 6L Extension 4: SupremeMissionArea is each category's fixed Supreme mission area (FIXED_CATEGORY_MISSION_AREAS).
INSERT INTO [Category] ([Category], [CategoryDescription], [SupremeMissionArea])
VALUES
('Fellowship', 'Social Knights events', 'Family'),
('Service', 'Providing help to parish, parishioners or community', 'Community'),
('Faith Building', 'Events focussed on increasing the faith or Knights and/or parishioners', 'Faith'),
('Parish Community', 'Events that involve parishioners in getting to know each other better or contributing to the parish', 'Community'),
('Fundraising', 'Generating income/donations for Knights council or parish', 'Community'),
('Evangelization', 'Promoting Catholic faith to non-Catholics', 'Faith');
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
('Lecturer', 0),
('Trustee 1', 1),
('Trustee 2', 1),
('Trustee 3', 1),
('Membership Director', 0),
('Community Director', 0),
('Program Director', 0),
('Family Director', 0),
('Chaplain', 0),
('Member', 0),
('Council Historian', 0); -- Sprint 6L: appointed by the Grand Knight; keeps the council history annals (not an officer seat)
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
-- Adds testadmin, testsuperadmin, and testmember profiles with password: dev-pass-secure-9912
-- =========================================================================

-- 1. Create a Default Baseline Council for Testing
INSERT INTO [Council] ([CouncilNumber], [CouncilName], [State], [Phone], [Email])
VALUES (15295, 'St. Jude Council', 'OR', '503-555-0199', 'kofc15295@gmail.com');
GO

-- 2. Create the Login Credentials (Passwords should be encrypted in production, plain for dev stub)
INSERT INTO [Credentials] ([Username], [Password])
VALUES 
('testsuperadmin@kofc.org', 'dev-pass-secure-9912'), -- ID 1
('testadmin@kofc.org', 'dev-pass-secure-9912'),      -- ID 2
('testmember@kofc.org', 'dev-pass-secure-9912');     -- ID 3
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

-- ==============================================================================
-- Phase 2 seeding
-- ==============================================================================
-- 1.  Working Status for member
Insert Into [WorkingStatus] ([WorkingStatus])
Values 
('Student'),
('Full Time'),
('Part Time'),
('Retired'),
('Unemployed');
GO
-- 2. Donation method
Insert Into [DonationMethod] ([DonationMethod])
Values 
('Cash'),
('Credit Card'),
('Venmo'),
('Zelle'),
('Zeffy'),
('Parishsoft'),
('Physical Items');
GO
-- 3. Donation type
Insert Into [DonationType] ([DonationType],[CouncilID])
Values 
('Parking', 1),
('Parish Event', 1),
('Meals', 1),
('Unsolicited', 1);
GO
-- 4. Skill
Insert Into [Skill] ([SkillName])
Values 
('Bartending'),
('Plumbing'),
('Electrical'),
('Carpentry'),
('Automotive'),
('Mechanical'),
('Cooking'),
('Baking'),
('Canning'),
('Graphic Arts'),
('Finances'),
('Computer'),
('Marketing'),
('Masonry'),
('Heating/Cooling');
GO
-- 5. Skill Level
Insert Into [SkillLevel] ([SkillLevel])
Values 
('Novice'),
('Beginner'),
('Intermediate'),
('Senior'),
('Expert');
GO
-- 6. Training classes
Insert Into [KOCTrainingClasses] ([ClassName])
Values 
('Background Check'),
('Preventing Abuse and Protecting Those We Serve');
GO
-- ==============================================================================
-- Sprint 5Y-3: budget categories (funds) of Council 15295 (CouncilID 1) only; every other council defines its own
-- ==============================================================================
Insert Into [CouncilBudgetCategory] ([CouncilID], [CategoryName])
Values 
(1, 'Father George Wolf Memorial Fund'),
(1, 'Sister Rita Rose Vistica Parish Community Fund'),
(1, 'Cathedral School & Student Support'),
(1, 'Other Donations & Projects'),
(1, 'Council Maintenance & State/Supreme Programs'),
(1, 'Blessed Michael McGivney Fraternal Activities Fund');
GO
-- ==============================================================================
-- Sprint 5Y-5: standard meeting types of Council 15295 (CouncilID 1) only; every other council defines its own
-- ==============================================================================
Insert Into [CouncilMeetingType] ([CouncilID], [TypeName])
Values 
(1, 'Monthly'),
(1, 'Officer'),
(1, 'Committee');
GO

-- ==============================================================================
-- Sprint 5Z-1: relationship types and mission areas of Council 15295 (CouncilID 1) only; every other council
-- defines its own. The mission areas are the four Faith in Action program pillars.
-- ==============================================================================
Insert Into [CouncilRelationshipType] ([CouncilID], [RelationshipName])
Values
(1, 'Parish Ministry'),
(1, 'Catholic School'),
(1, 'Local Nonprofit'),
(1, 'Member or Family in Need'),
(1, 'Community Partner'),
(1, 'State or Supreme Program');
GO
Insert Into [CouncilMissionArea] ([CouncilID], [MissionAreaName])
Values
(1, 'Faith'),
(1, 'Family'),
(1, 'Community'),
(1, 'Life');
GO

-- ==============================================================================
-- Sprint 5Z-5: the standing cadence of Council 15295's monthly meeting (CouncilMeetingType 1, 'Monthly'): the first
-- Tuesday of every month at 7:30 PM in the parish hall. meetings.populateAnnualCadence expands it per fraternal year.
-- ==============================================================================
Insert Into [CouncilCadenceConfig] ([CouncilID], [MeetingTypeID], [CadencePattern], [DefaultStartTime], [DefaultLocation])
Values
(1, 1, 'First Tuesday', '19:30', 'Parish Hall');
GO

-- ==============================================================================
-- Sprint 5Z-Activity-Registry: the standing operational activities of Council 15295 (CouncilID 1) only, ids 1-11 in
-- name order. Members log unscheduled hours against them; every other council defines its own. CategoryID: 1
-- Fellowship, 2 Service, 4 Parish Community, 5 Fundraising.
-- ==============================================================================
Insert Into [Activities] ([ActivityName], [ActivityDescription], [CategoryID], [CouncilID])
Values
('Bedding drive', 'Collecting blankets, sheets and pillows for families in need', 2, 1),
('Coats for kids', 'Collecting and distributing winter coats for local children', 2, 1),
('Food drive', 'Collecting and sorting food for the parish pantry', 2, 1),
('Greeting', 'Welcoming parishioners at the church doors before Mass', 4, 1),
('Meal delivery', 'Preparing and delivering meals to homebound and grieving families', 2, 1),
('Planning', 'Council planning and committee work outside scheduled meetings', 1, 1),
('Poop/Garbage patrol', 'Picking up litter and pet waste around the parish grounds', 2, 1),
('Socials', 'Hosting and staffing council and parish social gatherings', 1, 1),
('Transporting', 'Driving parishioners to Mass, appointments and council events', 2, 1),
('Ultrasound', 'Supporting the Ultrasound Initiative for local pregnancy centers', 5, 1),
('Ushering', 'Ushering and taking up the collection at Mass', 4, 1);
GO

-- ==============================================================================
-- Sprint 5Z-7: Council 15295's standard chart of accounts (GLAccount ids 1-14). The two virtual goal accounts are
-- earmarks inside Operating Checking (ParentAccountID 1). Sprint 5Z-8 targets: Goal #1 $4,000.00, Goal #2 $1,500.00.
-- ==============================================================================
Insert Into [GLAccount] ([CouncilID], [AccountName], [AccountType], [ParentAccountID], [IsVirtualGoal], [TargetGoalAmount])
Values
(1, 'Operating Checking', 'Asset', NULL, 0, 0.00),
(1, 'Goal Account #1', 'Asset', 1, 1, 4000.00),
(1, 'Goal Account #2', 'Asset', 1, 1, 1500.00),
(1, 'General Savings', 'Asset', NULL, 0, 0.00),
(1, 'Charity Savings', 'Asset', NULL, 0, 0.00),
(1, 'Physical Assets', 'Asset', NULL, 0, 0.00),
(1, 'Member Dues Collections', 'Revenue', NULL, 0, 0.00),
(1, 'Parking Fundraising', 'Revenue', NULL, 0, 0.00),
(1, 'General Fundraising', 'Revenue', NULL, 0, 0.00),
(1, 'General Donations', 'Revenue', NULL, 0, 0.00),
(1, 'Charitable Disbursements', 'Expense', NULL, 0, 0.00),
(1, 'Event Operational Costs', 'Expense', NULL, 0, 0.00),
(1, 'Council Operational Costs', 'Expense', NULL, 0, 0.00),
(1, 'Supreme Assessments', 'Expense', NULL, 0, 0.00);
GO

-- Sprint 5Z-8: Opening Balance Equity (GLAccount 15) takes the other side of the balances the council carries into the
-- ledger on day one, so the books start balanced.
Insert Into [GLAccount] ([CouncilID], [AccountName], [AccountType], [ParentAccountID], [IsVirtualGoal], [TargetGoalAmount])
Values
(1, 'Opening Balance Equity', 'Equity', NULL, 0, 0.00);
GO
-- @presentation-data
-- Everything below this marker is presentation data. The apps load it (presentationData: true); the automated
-- tests keep the minimal baseline above, so their fixture ids, vacant seats and empty ledgers stay stable.
-- ==============================================================================
-- Sprint 5Z-1: high-fidelity presentation data for Council 15295 (CouncilID 1)
-- Fifteen members seated across the officer and director roles (Credentials 4-18, Member 4-18, all with the dev
-- password dev-pass-secure-9912), ten reimbursed expense sheets, eight charity checks and five intake requests in the vetting
-- pipeline. Payouts fall between October 2025 and August 2026. Check numbers 1101-1118 are the council's checkbook.
-- Sprint 6B Patch: three members carry Member.DateJoinedCouncil (Supreme's join date): Joseph Hernandez (2026-05-01)
-- and Christopher Walsh (2026-07-15) show the New Member badge through the October 2026 demo; Daniel Mbeki
-- (2025-11-20) is past its 180 days. The others' join dates are not on file (NULL).
-- ==============================================================================
INSERT INTO [Credentials] ([Username], [Password])
VALUES
('michael.oconnor@kofc15295.org', 'dev-pass-secure-9912'),   -- ID 4
('james.delgado@kofc15295.org', 'dev-pass-secure-9912'),     -- ID 5
('patrick.nguyen@kofc15295.org', 'dev-pass-secure-9912'),    -- ID 6
('thomas.kowalski@kofc15295.org', 'dev-pass-secure-9912'),   -- ID 7
('robert.fitzgerald@kofc15295.org', 'dev-pass-secure-9912'), -- ID 8
('anthony.russo@kofc15295.org', 'dev-pass-secure-9912'),     -- ID 9
('daniel.mbeki@kofc15295.org', 'dev-pass-secure-9912'),      -- ID 10
('joseph.hernandez@kofc15295.org', 'dev-pass-secure-9912'),  -- ID 11
('francis.byrne@kofc15295.org', 'dev-pass-secure-9912'),     -- ID 12
('william.schmidt@kofc15295.org', 'dev-pass-secure-9912'),   -- ID 13
('george.alvarez@kofc15295.org', 'dev-pass-secure-9912'),    -- ID 14
('peter.lindqvist@kofc15295.org', 'dev-pass-secure-9912'),   -- ID 15
('matthew.okafor@kofc15295.org', 'dev-pass-secure-9912'),    -- ID 16
('stephen.tran@kofc15295.org', 'dev-pass-secure-9912'),      -- ID 17
('christopher.walsh@kofc15295.org', 'dev-pass-secure-9912'); -- ID 18
GO

INSERT INTO [Member] (
    [CouncilID], [MemberNumber], [MemberFirstName], [MemberLastName],
    [Phone], [StreetAddress1], [City], [State], [ZipCode], [Email],
    [DateOfBirth], [StatusID], [DegreeID], [MemberTypeID], [CredentialID], [DateJoinedCouncil]
)
VALUES
(1, 4817263, 'Michael', 'O''Connor', '503-555-0142', '2215 NE Klickitat St', 'Portland', 'OR', '97212', 'michael.oconnor@kofc15295.org', '1968-03-14', 1, 4, 3, 4, NULL),
(1, 5120938, 'James', 'Delgado', '503-555-0187', '4410 SE Woodstock Blvd', 'Portland', 'OR', '97206', 'james.delgado@kofc15295.org', '1975-07-22', 1, 3, 3, 5, NULL),
(1, 5388201, 'Patrick', 'Nguyen', '503-555-0123', '918 SW Vista Ave', 'Portland', 'OR', '97205', 'patrick.nguyen@kofc15295.org', '1982-11-02', 1, 3, 3, 6, NULL),
(1, 4290115, 'Thomas', 'Kowalski', '503-555-0164', '7336 N Lombard St', 'Portland', 'OR', '97203', 'thomas.kowalski@kofc15295.org', '1961-05-09', 1, 4, 3, 7, NULL),
(1, 5602774, 'Robert', 'Fitzgerald', '503-555-0118', '1507 NE Tillamook St', 'Portland', 'OR', '97212', 'robert.fitzgerald@kofc15295.org', '1979-01-27', 1, 3, 3, 8, NULL),
(1, 5741390, 'Anthony', 'Russo', '503-555-0171', '3620 SE Belmont St', 'Portland', 'OR', '97214', 'anthony.russo@kofc15295.org', '1987-09-18', 1, 3, 3, 9, NULL),
(1, 6013456, 'Daniel', 'Mbeki', '503-555-0139', '5104 NE Sandy Blvd', 'Portland', 'OR', '97213', 'daniel.mbeki@kofc15295.org', '1991-04-05', 1, 2, 3, 10, '2025-11-20'),
(1, 6128873, 'Joseph', 'Hernandez', '503-555-0156', '8825 SE Powell Blvd', 'Portland', 'OR', '97266', 'joseph.hernandez@kofc15295.org', '1994-12-11', 1, 1, 3, 11, '2026-05-01'),
(1, 3987412, 'Francis', 'Byrne', '503-555-0102', '2830 SW Patton Rd', 'Portland', 'OR', '97201', 'francis.byrne@kofc15295.org', '1955-08-30', 1, 4, 3, 12, NULL),
(1, 4105629, 'William', 'Schmidt', '503-555-0195', '6419 SW Capitol Hwy', 'Portland', 'OR', '97239', 'william.schmidt@kofc15295.org', '1958-02-16', 1, 4, 3, 13, NULL),
(1, 4632087, 'George', 'Alvarez', '503-555-0148', '1122 NE 64th Ave', 'Portland', 'OR', '97213', 'george.alvarez@kofc15295.org', '1964-10-04', 1, 3, 3, 14, NULL),
(1, 5519024, 'Peter', 'Lindqvist', '503-555-0177', '4027 N Williams Ave', 'Portland', 'OR', '97227', 'peter.lindqvist@kofc15295.org', '1983-06-21', 1, 3, 3, 15, NULL),
(1, 5876310, 'Matthew', 'Okafor', '503-555-0131', '2718 SE Division St', 'Portland', 'OR', '97202', 'matthew.okafor@kofc15295.org', '1989-03-08', 1, 3, 3, 16, NULL),
(1, 5933847, 'Stephen', 'Tran', '503-555-0184', '9310 SW Barbur Blvd', 'Portland', 'OR', '97219', 'stephen.tran@kofc15295.org', '1986-12-29', 1, 3, 3, 17, NULL),
(1, 6245501, 'Christopher', 'Walsh', '503-555-0169', '1645 NW Kearney St', 'Portland', 'OR', '97209', 'christopher.walsh@kofc15295.org', '1998-07-15', 1, 2, 3, 18, '2026-07-15');
GO

INSERT INTO [MemberRoles] ([RoleID], [MemberID])
VALUES
(2, 4),   -- Deputy Grand Knight
(3, 5),   -- Chancellor
(4, 6),   -- Recorder
(6, 7),   -- Treasurer
(7, 8),   -- Warden
(8, 9),   -- Advocate
(9, 10),  -- Inside Guard
(10, 11), -- Outside Guard
(12, 12), -- Trustee 1
(13, 13), -- Trustee 2
(14, 14), -- Trustee 3
(17, 15), -- Program Director
(18, 16), -- Family Director
(15, 17), -- Membership Director
(16, 18); -- Community Director
GO

-- Ten reimbursed expense sheets, each paid by its own check (1101-1110).
INSERT INTO [ExpenseDisbursement] ([CouncilID], [CheckNumber], [PayoutDate], [TotalAmount], [Notes])
VALUES
(1, '1101', '2025-10-08', 186.42, 'Columbus Day pancake breakfast supplies'),
(1, '1102', '2025-11-12', 312.75, 'Coats for Kids distribution'),
(1, '1103', '2025-12-10', 245.18, 'Advent family night'),
(1, '1104', '2026-01-14', 94.60, 'Officer installation printing'),
(1, '1105', '2026-02-11', 428.33, 'Lenten fish fry supplies'),
(1, '1106', '2026-03-11', 157.90, 'Free Throw Championship awards'),
(1, '1107', '2026-04-08', 212.46, 'Easter egg hunt'),
(1, '1108', '2026-05-13', 138.25, 'Rosary rally sound rental'),
(1, '1109', '2026-07-08', 364.80, 'Parish picnic grill supplies'),
(1, '1110', '2026-08-12', 119.99, 'Back-to-school backpack drive');
GO
-- Sprint 5Z-4: every paid sheet carries both dual-approval signatures, the Financial Secretary's written order
-- (member 2) and the Grand Knight's counter-signature (member 1). Sheets 11-13 are in the pipeline: one awaiting the
-- written order, one awaiting the counter-signature, and one dual-signed in the Treasurer's disbursement vault.
INSERT INTO [ExpenseReport] ([CouncilID], [SubmitterMemberID], [Status], [DisbursementID], [FinancialSecretaryMemberID], [FinancialSecretaryApprovedAt], [GrandKnightMemberID], [GrandKnightApprovedAt])
VALUES
(1, 4, 'Reimbursed', 1, 2, '2025-10-06 16:10:00', 1, '2025-10-07 18:45:00'),
(1, 15, 'Reimbursed', 2, 2, '2025-11-10 15:30:00', 1, '2025-11-11 19:05:00'),
(1, 16, 'Reimbursed', 3, 2, '2025-12-08 16:20:00', 1, '2025-12-09 18:15:00'),
(1, 6, 'Reimbursed', 4, 2, '2026-01-12 17:00:00', 1, '2026-01-13 18:30:00'),
(1, 15, 'Reimbursed', 5, 2, '2026-02-09 16:40:00', 1, '2026-02-10 19:20:00'),
(1, 17, 'Reimbursed', 6, 2, '2026-03-09 15:55:00', 1, '2026-03-10 18:00:00'),
(1, 16, 'Reimbursed', 7, 2, '2026-04-06 16:25:00', 1, '2026-04-07 18:50:00'),
(1, 5, 'Reimbursed', 8, 2, '2026-05-11 17:10:00', 1, '2026-05-12 18:35:00'),
(1, 18, 'Reimbursed', 9, 2, '2026-07-06 16:05:00', 1, '2026-07-07 19:10:00'),
(1, 16, 'Reimbursed', 10, 2, '2026-08-10 15:45:00', 1, '2026-08-11 18:25:00'),
(1, 9, 'Submitted', NULL, NULL, NULL, NULL, NULL),
(1, 11, 'Submitted', NULL, 2, '2026-09-16 17:30:00', NULL, NULL),
(1, 14, 'Approved', NULL, 2, '2026-09-08 16:15:00', 1, '2026-09-09 18:40:00');
GO
INSERT INTO [ExpenseLineItem] ([ExpenseReportID], [DateOfExpense], [Amount], [VendorName], [ExpenseDescription])
VALUES
(1, '2025-10-04', 142.17, 'Cash & Carry', 'Pancake mix, syrup, sausage and coffee'),
(1, '2025-10-04', 44.25, 'Safeway', 'Orange juice and paper plates'),
(2, '2025-11-08', 312.75, 'Fred Meyer', 'Forty children''s winter coats (council match)'),
(3, '2025-12-06', 198.43, 'WinCo Foods', 'Soup supper ingredients'),
(3, '2025-12-06', 46.75, 'Michaels', 'Advent wreath craft kits'),
(4, '2026-01-09', 94.60, 'Staples Print Center', 'Installation programs and certificates'),
(5, '2026-02-06', 356.08, 'Pacific Seafood', 'Cod fillets for the fish fry'),
(5, '2026-02-06', 72.25, 'Restaurant Depot', 'Fryer oil and to-go boxes'),
(6, '2026-03-07', 157.90, 'Crown Trophy', 'Free Throw Championship trophies and ribbons'),
(7, '2026-04-02', 168.21, 'Costco', 'Candy and plastic eggs'),
(7, '2026-04-02', 44.25, 'Party City', 'Prize baskets'),
(8, '2026-05-09', 138.25, 'Portland Sound Rentals', 'PA system rental for the rosary rally'),
(9, '2026-07-02', 289.55, 'Costco', 'Burgers, hot dogs and buns'),
(9, '2026-07-02', 75.25, 'Home Depot', 'Propane refills'),
(10, '2026-08-07', 119.99, 'Target', 'Backpacks and school supplies'),
(11, '2026-09-12', 86.40, 'Safeway', 'Coffee and donuts for the Knights breakfast'),
(12, '2026-09-10', 64.99, 'Office Depot', 'Membership drive flyers and table signage'),
(12, '2026-09-10', 23.50, 'FedEx Office', 'Laminated sign-up sheets'),
(13, '2026-09-05', 142.75, 'Cash & Carry', 'Ice, water and paper goods for the parish festival booth');
GO

-- Five local charities the council gives to, with the eight checks it paid them (1111-1118).
INSERT INTO [GlobalCharityRegistry] ([Name], [Description], [EIN], [State], [Phone], [ContactName], [ContactEmail], [Address], [ZipCode], [IsCatholic], [CharityType], [IsAnnual])
VALUES
('St. Jude Parish Food Pantry', 'Weekly groceries for families in the parish boundaries', NULL, 'OR', '503-555-0210', 'Maria Santos', 'pantry@stjudeparish.org', '5200 NE Alameda St, Portland', '97213', 1, 'Food Security', 1),
('Holy Family Pregnancy Resource Center', 'Free ultrasounds, diapers and parenting classes for expectant mothers', NULL, 'OR', '503-555-0233', 'Ann Kelly', 'director@holyfamilyprc.org', '1820 SE 39th Ave, Portland', '97214', 1, 'Protecting Life', 1),
('Rose City Warming Shelter', 'Overnight winter shelter and hot meals', NULL, 'OR', '503-555-0247', 'David Lee', 'info@rosecitywarming.org', '640 NW Glisan St, Portland', '97209', 0, 'Homelessness', 0),
('Cathedral School Tuition Assistance Fund', 'Need-based tuition aid for Catholic school families', NULL, 'OR', '503-555-0259', 'Sr. Theresa Nolan', 'aid@cathedralschoolpdx.org', '110 NW 17th Ave, Portland', '97209', 1, 'Faith', 1),
('Mothers of Hope Transitional Housing', 'Transitional housing for single mothers and their children', NULL, 'OR', '503-555-0266', 'Linda Park', 'office@mothersofhope.org', '3345 N Vancouver Ave, Portland', '97227', 0, 'Women and Children', 0);
GO
INSERT INTO [CouncilCharityLink] ([CouncilID], [CharityID], [ConnectedAt])
VALUES
(1, 1, '2025-09-15 18:00:00'),
(1, 2, '2025-09-15 18:00:00'),
(1, 3, '2025-11-03 18:30:00'),
(1, 4, '2026-01-12 19:00:00'),
(1, 5, '2026-03-09 19:00:00');
GO
INSERT INTO [CharitableDisbursementLedger] ([CouncilID], [CharityID], [Amount], [CheckNumber], [DisbursedByID], [PayoutDate], [Notes])
VALUES
(1, 1, 500.00, '1111', 2, '2025-10-20', 'Fall food drive match'),
(1, 2, 750.00, '1112', 2, '2025-11-17', 'Ultrasound machine fund'),
(1, 3, 400.00, '1113', 7, '2025-12-15', 'Winter blankets'),
(1, 1, 500.00, '1114', 2, '2026-01-19', 'Winter pantry restock'),
(1, 4, 1000.00, '1115', 7, '2026-02-16', 'Spring tuition assistance'),
(1, 2, 600.00, '1116', 2, '2026-03-23', 'Baby bottle campaign proceeds'),
(1, 5, 350.00, '1117', 7, '2026-05-18', 'Mother''s Day gift cards'),
(1, 1, 450.00, '1118', 2, '2026-08-17', 'Back-to-school lunch program');
GO

-- Five intake requests in the vetting pipeline: two awaiting a vetter, two claimed by Trustees, one advanced to the vote.
INSERT INTO [CharitableRequest] (
    [CouncilID], [OrganizationName], [ContactName], [ContactPhone], [ContactEmail], [AmountRequested], [RequestStatus], [SubmittedAt],
    [ShepherdMemberID], [MailingAddress], [RelationshipTypeID], [Is501c3], [EIN], [Website], [OrgMission], [IsRecurring],
    [FundsNeededBy], [SpecificUse], [TargetBeneficiary], [AccountabilityPlan], [RequestTier],
    [VetterMemberID], [VettingNotes], [VettedDate], [VoteStatus], [AmountApproved], [MissionAreaID]
)
VALUES
(1, 'St. Jude Youth Ministry', 'Kevin Brandt', '503-555-0301', 'youth@stjudeparish.org', 800.00, 'Submitted', '2026-09-14 19:22:00',
 15, '5200 NE Alameda St, Portland, OR 97213', 1, 0, NULL, 'https://stjudeparish.org/youth', 'Forming high-school students in faith and service', 0,
 '2026-10-31 00:00:00', 'Bus rental and registration for the diocesan youth rally', 'Thirty parish teens', 'Receipts and a photo report to the council', 1,
 NULL, NULL, NULL, 'Pending', 0.00, 1),
(1, 'Portland Refugee Welcome Network', 'Amina Yusuf', '503-555-0318', 'amina@prwn.org', 1500.00, 'Submitted', '2026-09-21 20:05:00',
 18, '2250 SE 82nd Ave, Portland, OR 97216', 5, 1, NULL, 'https://prwn.org', 'Resettling refugee families arriving in Portland', 0,
 '2026-11-15 00:00:00', 'Starter kitchen kits for five newly arrived families', 'Five refugee families', 'Itemized purchase list and thank-you letters', 2,
 NULL, NULL, NULL, 'Pending', 0.00, 3),
(1, 'Cathedral School Robotics Club', 'Joan Pratt', '503-555-0325', 'robotics@cathedralschoolpdx.org', 650.00, 'Claimed by Trustee', '2026-08-26 18:40:00',
 17, '110 NW 17th Ave, Portland, OR 97209', 2, 0, NULL, 'https://cathedralschoolpdx.org', 'STEM enrichment for Catholic middle-schoolers', 1,
 '2026-10-10 00:00:00', 'Competition registration and replacement parts', 'Twelve seventh and eighth graders', 'Club treasurer reports spending at the November meeting', 1,
 12, 'Called the principal; the club is school-sponsored. Asked for last year''s budget.', NULL, 'Pending', 0.00, 2),
(1, 'Gabriel House Maternity Home', 'Rebecca Moore', '503-555-0337', 'rmoore@gabrielhouse.org', 2500.00, 'Claimed by Trustee', '2026-08-18 21:15:00',
 4, '4730 SE Hawthorne Blvd, Portland, OR 97215', 3, 1, NULL, 'https://gabrielhouse.org', 'A home for pregnant women facing homelessness', 1,
 '2026-12-01 00:00:00', 'Crib and car-seat replacements for the nursery', 'Eight mothers and their newborns', 'Invoices plus a site visit by the vetter', 2,
 13, 'Confirmed 501(c)(3) status. Site visit booked for October 3.', NULL, 'Pending', 0.00, 4),
(1, 'Portland Metro Special Olympics Teams', 'Chris Dunn', '503-555-0349', 'coach@pdxmetroathletes.org', 1000.00, 'Advanced', '2026-07-29 17:55:00',
 16, '6400 SE Lake Rd, Milwaukie, OR 97222', 6, 1, NULL, 'https://pdxmetroathletes.org', 'Year-round sports training for athletes with intellectual disabilities', 1,
 '2026-10-20 00:00:00', 'Uniforms for the fall bocce and basketball teams', 'Forty metro-area athletes', 'Team photo and roster sent to the council', 2,
 14, 'Long-standing Knights partner program; financials reviewed. Recommend the full amount.', '2026-09-02 20:30:00', 'Pending', 0.00, 3);
GO

-- ==============================================================================
-- Sprint 5Z-2: Faith-in-Action presentation events for Council 15295, two per mission area (Faith 1, Family 2,
-- Community 3, Life 4), July - September 2026, each with one shift, its volunteers' logged hours and its recorded
-- donations. Funds raised on each event match its cash and electronic donations; the pantry's physical items are
-- not money and count toward neither.
-- ==============================================================================
INSERT INTO [Event] ([EventName], [EventDescription], [OwnerID], [StartDate], [EndDate], [Location], [CategoryID], [FundsRaised-Cash], [FundsRaised-Electronic], [Highlights], [PlannedNumberAttendees], [ActualNumberAttendees], [IsAnnual], [IsMultiDay], [MissionAreaID])
VALUES
('Rosary Rally at the Parish Grotto', 'Public rosary for peace with the Knights leading the decades', 4, '2026-07-12', '2026-07-12', 'St. Jude Parish Grotto', 3, 180.00, 0.00, 'Over ninety parishioners prayed all five decades despite the heat.', 80, 94, 0, 0, 1),
('Holy Hour for Vocations', 'Eucharistic adoration praying for priestly and religious vocations', 5, '2026-09-10', '2026-09-10', 'St. Jude Church', 3, 95.00, 0.00, 'Two seminarians joined us and spoke after Benediction.', 40, 37, 0, 0, 1),
('Parish Family Picnic', 'Summer picnic with games, a bounce house and a Knights grill line', 16, '2026-07-26', '2026-07-26', 'Laurelhurst Park, Picnic Area B', 1, 640.00, 215.00, 'Record turnout; the grill line served 310 plates.', 250, 312, 1, 0, 2),
('Back-to-School Pancake Breakfast', 'Pancake breakfast raising school-supply money for parish families', 15, '2026-08-16', '2026-08-16', 'St. Jude Parish Hall', 5, 525.00, 310.00, 'Funded forty backpacks for the school drive.', 180, 205, 1, 0, 2),
('Tootsie Roll Drive for Special Olympics', 'Annual candy drive at grocery stores for people with intellectual disabilities', 18, '2026-08-22', '2026-08-22', 'Fred Meyer and Safeway entrances, NE Portland', 5, 1120.50, 260.00, 'Our best drive in five years.', 0, 0, 1, 0, 3),
('Food Pantry Restock Day', 'Sorting and shelving donated groceries at the parish pantry', 17, '2026-09-12', '2026-09-12', 'St. Jude Parish Food Pantry', 2, 150.00, 0.00, 'Restocked every shelf before the fall rush.', 0, 0, 0, 0, 3),
('Baby Bottle Campaign Kickoff', 'Baby bottles handed out after every Mass to collect change for the pregnancy center', 14, '2026-07-19', '2026-07-19', 'St. Jude Church narthex', 5, 865.25, 400.00, 'Six hundred bottles went home with families.', 500, 600, 1, 0, 4),
('Pregnancy Center Nursery Painting', 'Painting and furnishing the nursery at Holy Family Pregnancy Resource Center', 13, '2026-09-19', '2026-09-19', 'Holy Family Pregnancy Resource Center', 2, 0.00, 0.00, 'The nursery reopened the following Monday.', 0, 0, 0, 0, 4);
GO
INSERT INTO [EventCouncils] ([EventID], [CouncilID])
VALUES
(1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 1), (8, 1);
GO
INSERT INTO [Shift] ([ShiftName], [ShiftDescription], [ShiftDate], [StartTime], [EndTime], [EventID], [MinNumberVolunteers], [NumberVolunteersSignedUp])
VALUES
('Rally marshals', 'Set up chairs and sound, lead the decades', '2026-07-12', '09:00:00', '12:00:00', 1, 3, 3),
('Adoration guard', 'Keep watch before the Blessed Sacrament', '2026-09-10', '18:30:00', '20:30:00', 2, 2, 2),
('Grill and games crew', 'Run the grill line and the children''s games', '2026-07-26', '10:00:00', '15:00:00', 3, 4, 5),
('Griddle crew', 'Cook and serve pancakes', '2026-08-16', '07:00:00', '11:00:00', 4, 4, 4),
('Store-front collectors', 'Hand out Tootsie Rolls and collect donations', '2026-08-22', '09:00:00', '15:00:00', 5, 4, 5),
('Pantry shelvers', 'Sort, date and shelve groceries', '2026-09-12', '08:00:00', '12:00:00', 6, 3, 3),
('Bottle distributors', 'Hand out bottles after each Mass', '2026-07-19', '08:00:00', '13:00:00', 7, 3, 3),
('Painting crew', 'Prime, paint and assemble cribs', '2026-09-19', '09:00:00', '14:00:00', 8, 4, 4);
GO
INSERT INTO [EventSignup] ([ShiftID], [MemberID], [NoShow])
VALUES
(1, 4, 0), (1, 8, 0), (1, 12, 0),
(2, 5, 0), (2, 9, 0),
(3, 16, 0), (3, 10, 0), (3, 11, 0), (3, 15, 0), (3, 18, 0),
(4, 15, 0), (4, 6, 0), (4, 7, 0), (4, 17, 0),
(5, 18, 0), (5, 9, 0), (5, 10, 0), (5, 11, 0), (5, 13, 0),
(6, 17, 0), (6, 12, 0), (6, 14, 0),
(7, 14, 0), (7, 4, 0), (7, 13, 0),
(8, 13, 0), (8, 8, 0), (8, 5, 0), (8, 16, 0);
GO
INSERT INTO [EventTime] ([ShiftID], [MemberID], [Hours])
VALUES
(1, 4, 3.00), (1, 8, 3.00), (1, 12, 2.50),
(2, 5, 2.00), (2, 9, 2.00),
(3, 16, 5.00), (3, 10, 5.00), (3, 11, 4.50), (3, 15, 5.00), (3, 18, 4.00),
(4, 15, 4.00), (4, 6, 4.00), (4, 7, 3.50), (4, 17, 4.00),
(5, 18, 6.00), (5, 9, 6.00), (5, 10, 5.50), (5, 11, 6.00), (5, 13, 4.00),
(6, 17, 4.00), (6, 12, 4.00), (6, 14, 3.75),
(7, 14, 5.00), (7, 4, 4.50), (7, 13, 5.00),
(8, 13, 5.00), (8, 8, 5.00), (8, 5, 4.75), (8, 16, 5.00);
GO
-- DonationMethodID: 1 Cash, 2 Credit Card, 3 Venmo, 4 Zelle, 7 Physical Items. DonationTypeID: 2 Parish Event, 3 Meals, 4 Unsolicited.
INSERT INTO [Donation] ([CouncilID], [DonationDate], [DonationMethodID], [DonationTypeID], [Donor], [DonationDesciption], [EventID], [DonationAmount], [RecordedBy])
VALUES
(1, '2026-07-12', 1, 2, NULL, 'Rally free-will offering', 1, 180.00, 7),
(1, '2026-09-10', 1, 2, NULL, 'Holy Hour vocations basket', 2, 95.00, 7),
(1, '2026-07-26', 1, 3, NULL, 'Picnic plates, cash', 3, 640.00, 7),
(1, '2026-07-26', 3, 3, NULL, 'Picnic plates, Venmo', 3, 215.00, 7),
(1, '2026-08-16', 1, 3, NULL, 'Pancake plates, cash', 4, 525.00, 2),
(1, '2026-08-16', 2, 3, NULL, 'Pancake plates, card reader', 4, 310.00, 2),
(1, '2026-08-22', 1, 4, NULL, 'Tootsie Roll cans', 5, 1120.50, 7),
(1, '2026-08-22', 3, 4, NULL, 'Tootsie Roll QR code', 5, 260.00, 7),
(1, '2026-09-12', 1, 4, 'Anonymous parishioner', 'Pantry cash gift', 6, 150.00, 2),
(1, '2026-09-12', 7, 4, 'Safeway NE Broadway', 'Pallet of canned goods (physical items)', 6, 300.00, 2),
(1, '2026-07-19', 1, 2, NULL, 'Baby bottles returned, cash and coins', 7, 865.25, 7),
(1, '2026-07-19', 4, 2, NULL, 'Baby bottle campaign, Zelle', 7, 400.00, 7);
GO

-- ==============================================================================
-- Sprint 6F: Council 15295's (CouncilID 1) real 2026-2027 budget, from St. Mary's "BUDGET SUMMARY - 2026-2027
-- Fraternal Year" spreadsheet: 40 lines under the six funds above, totalling 41,700.00 (subtotals 4,600 / 3,400 /
-- 4,200 / 14,300 / 8,900 / 6,300), voted and so Approved at version 1. The spreadsheet's * ("funded by request or when an
-- event/recipient is available") is moved from the name into Notes, so 'Miscellaneous Others' is the Sprint 6E
-- catch-all line. Council-run gatherings are Event lines with no ReferenceSourceID (linked to an event by name, Sprint
-- 6C); every other line is Operational, since the recipients are not GlobalCharityRegistry rows. PrePopulatedAmount is
-- 0.00: no prior-year actuals came with the spreadsheet. quantity/unit_cost follow the spreadsheet's own counts where
-- they divide evenly. universal_category maps each line to its universal financial category (Sprint 6F,
-- UNIVERSAL_BUDGET_CATEGORIES in budget.ts); the fund names stay St. Mary's own, and the 'Other Donations & Projects'
-- fund splits into CHARITABLE_DONATIONS and CAPITAL_PROJECTS.
-- ==============================================================================
INSERT INTO [CouncilBudgetForecast] ([CouncilID], [FraternalYear], [CategoryType], [ReferenceSourceID], [LineItemName], [PrePopulatedAmount], [ApprovedBudgetAmount], [Notes], [BudgetCategoryID], [ProposedBudgetAmount], [BudgetStatus], [quantity], [unit_cost], [budget_version], [universal_category])
VALUES
(1, '2026-2027', 'Operational', NULL, 'Annual Donation to Pastor', 0.00, 1400.00, 'For any purpose chosen by our Pastor', 1, 1400.00, 'Approved', 1, 0.00, 1, 'CHARITABLE_DONATIONS'),
(1, '2026-2027', 'Operational', NULL, 'Donation for Deacon or Parochial Vicar', 0.00, 500.00, 'For any purpose chosen by our Deacon', 1, 500.00, 'Approved', 1, 0.00, 1, 'CHARITABLE_DONATIONS'),
(1, '2026-2027', 'Operational', NULL, 'Annual Donation for Church Office Staff', 0.00, 300.00, '$150/staff member, for personal use', 1, 300.00, 'Approved', 2, 150.00, 1, 'CHARITABLE_DONATIONS'),
(1, '2026-2027', 'Operational', NULL, 'Annual Donation to Seminarian(s)', 0.00, 700.00, 'Funded by request or when an event/recipient is available. $700 provided by the Council; starting 7/1; RSVP', 1, 700.00, 'Approved', 1, 0.00, 1, 'CHARITABLE_DONATIONS'),
(1, '2026-2027', 'Operational', NULL, 'Pennies for Heaven', 0.00, 400.00, 'Supreme/State program: supports seminarians', 1, 400.00, 'Approved', 1, 0.00, 1, 'CHARITABLE_DONATIONS'),
(1, '2026-2027', 'Operational', NULL, 'Seminarian and Parochial Vicar Contributions', 0.00, 1300.00, 'Funded by request or when an event/recipient is available. For Cathedral seminarians (up to $1,300 total)', 1, 1300.00, 'Approved', 1, 0.00, 1, 'CHARITABLE_DONATIONS'),
(1, '2026-2027', 'Event', NULL, 'Pancake Breakfasts (3x/year - Oct, Feb, May)', 0.00, 1100.00, '$370/breakfast: food & beverages ~60 people plus ~$70/breakfast for supplies', 2, 1100.00, 'Approved', 3, 0.00, 1, 'COMMUNITY_EVENTS'),
(1, '2026-2027', 'Event', NULL, 'Annual Parish Barbecue', 0.00, 1600.00, 'Food, beverages, and supplies; serves ~170 people (~$9.50/person)', 2, 1600.00, 'Approved', 1, 0.00, 1, 'COMMUNITY_EVENTS'),
(1, '2026-2027', 'Event', NULL, 'Simple Suppers (5x/year - Lenten Fridays + fish fry)', 0.00, 700.00, 'Most food donated by volunteer hosts; fish fry and supplies are main expense', 2, 700.00, 'Approved', 5, 140.00, 1, 'COMMUNITY_EVENTS'),
(1, '2026-2027', 'Event', NULL, 'Annual Cathedral School Event', 0.00, 1000.00, 'Annual Autumn gathering; goes to general fund', 3, 1000.00, 'Approved', 1, 0.00, 1, 'YOUTH_PROGRAMS'),
(1, '2026-2027', 'Operational', NULL, 'Awards for Cathedral Students', 0.00, 600.00, 'Cash awards: one boy, one girl; three plaques', 3, 600.00, 'Approved', 1, 0.00, 1, 'YOUTH_PROGRAMS'),
(1, '2026-2027', 'Operational', NULL, 'St. Mary''s Cathedral Tuition Fund', 0.00, 1000.00, 'Via Cathedral Parish; helps families with financial need', 3, 1000.00, 'Approved', 1, 0.00, 1, 'CHARITABLE_DONATIONS'),
(1, '2026-2027', 'Operational', NULL, 'Scouts General Support', 0.00, 300.00, 'For scouting affiliated with Cathedral School students', 3, 300.00, 'Approved', 1, 0.00, 1, 'CHARITABLE_DONATIONS'),
(1, '2026-2027', 'Event', NULL, 'Bingo for April in Paris[h]', 0.00, 500.00, 'Food, beverages, and prizes for bingo night', 3, 500.00, 'Approved', 1, 0.00, 1, 'YOUTH_PROGRAMS'),
(1, '2026-2027', 'Event', NULL, 'Field Day for Graduation', 0.00, 800.00, 'Knights provide burgers, snow cones, etc.', 3, 800.00, 'Approved', 1, 0.00, 1, 'YOUTH_PROGRAMS'),
(1, '2026-2027', 'Operational', NULL, 'St. Andrew Nativity School', 0.00, 1000.00, 'Benefit lunch; provides free education', 4, 1000.00, 'Approved', 1, 0.00, 1, 'CHARITABLE_DONATIONS'),
(1, '2026-2027', 'Operational', NULL, 'Community Faith Services', 0.00, 500.00, 'Donation for Legion of Mary, Cathedral', 4, 500.00, 'Approved', 1, 0.00, 1, 'CHARITABLE_DONATIONS'),
(1, '2026-2027', 'Operational', NULL, 'Our Lady of Peace Retreat House', 0.00, 1000.00, 'Contribution for equipment/facilities improvements', 4, 1000.00, 'Approved', 1, 0.00, 1, 'CHARITABLE_DONATIONS'),
(1, '2026-2027', 'Operational', NULL, 'Parking Lot Maintenance', 0.00, 1000.00, 'Funded by request or when an event/recipient is available. Lot striping expenses, signage', 4, 1000.00, 'Approved', 1, 0.00, 1, 'CAPITAL_PROJECTS'),
(1, '2026-2027', 'Operational', NULL, 'Other Cathedral Maintenance', 0.00, 1000.00, 'Funded by request or when an event/recipient is available. Lights, paint; can be carried to next year', 4, 1000.00, 'Approved', 1, 0.00, 1, 'CAPITAL_PROJECTS'),
(1, '2026-2027', 'Operational', NULL, 'Family Clinic', 0.00, 1000.00, 'Funded by request or when an event/recipient is available. Open to all; activities focus on Catholic ethics', 4, 1000.00, 'Approved', 1, 0.00, 1, 'CHARITABLE_DONATIONS'),
(1, '2026-2027', 'Operational', NULL, 'Sisters of Mary of Kakamega', 0.00, 1000.00, 'Supports children in African centers', 4, 1000.00, 'Approved', 1, 0.00, 1, 'CHARITABLE_DONATIONS'),
(1, '2026-2027', 'Operational', NULL, 'Food for Families (e.g., Lift Up)', 0.00, 500.00, 'Funded by request or when an event/recipient is available. Adds to Lenten food collection efforts', 4, 500.00, 'Approved', 1, 0.00, 1, 'CHARITABLE_DONATIONS'),
(1, '2026-2027', 'Operational', NULL, 'St. Patrick Parish Benefit Lunch', 0.00, 300.00, 'Funded by request or when an event/recipient is available. Up to 10 members at $30 each (reimbursed)', 4, 300.00, 'Approved', 10, 30.00, 1, 'CHARITABLE_DONATIONS'),
(1, '2026-2027', 'Operational', NULL, 'Miscellaneous Others', 0.00, 2500.00, 'Funded by request or when an event/recipient is available. Special requests/projects; typically $500 each (e.g., Medical Team Intl., Mother & Child). Sprint 6E catch-all: approved spend and gifts with no budget line of their own', 4, 2500.00, 'Approved', 1, 0.00, 1, 'MISCELLANEOUS'),
(1, '2026-2027', 'Operational', NULL, 'Major Project(s)', 0.00, 4500.00, 'Ultrasound; destination/amount determined by future council vote', 4, 4500.00, 'Approved', 1, 0.00, 1, 'CAPITAL_PROJECTS'),
(1, '2026-2027', 'Operational', NULL, 'State Convention', 0.00, 1000.00, 'Funded by request or when an event/recipient is available. Expenses for two representatives (and wives)', 5, 1000.00, 'Approved', 1, 0.00, 1, 'ADMINISTRATIVE_OPERATIONS'),
(1, '2026-2027', 'Operational', NULL, 'Exemplification / Member Support', 0.00, 500.00, 'Membership and degree advancement; 4th degree fees', 5, 500.00, 'Approved', 1, 0.00, 1, 'MEMBERSHIP_RECOGNITION'),
(1, '2026-2027', 'Operational', NULL, 'Equipment Purchases', 0.00, 500.00, 'Funded by request or when an event/recipient is available. Purchases not covered under other budget headings', 5, 500.00, 'Approved', 1, 0.00, 1, 'ADMINISTRATIVE_OPERATIONS'),
(1, '2026-2027', 'Operational', NULL, 'Shirts, Plaques, Badges, Pins', 0.00, 400.00, 'Funded by request or when an event/recipient is available. Materials representing the Knights', 5, 400.00, 'Approved', 1, 0.00, 1, 'MEMBERSHIP_RECOGNITION'),
(1, '2026-2027', 'Operational', NULL, 'Cathedral Bulletin Ad', 0.00, 1300.00, 'Annual cost; promotes Knights membership', 5, 1300.00, 'Approved', 1, 0.00, 1, 'ADMINISTRATIVE_OPERATIONS'),
(1, '2026-2027', 'Operational', NULL, 'Per Capita, Bank Fees, Postage', 0.00, 1500.00, '~$24/member x 60 members', 5, 1500.00, 'Approved', 1, 0.00, 1, 'ADMINISTRATIVE_OPERATIONS'),
(1, '2026-2027', 'Operational', NULL, 'Contributions to State/Supreme & K of C Projects', 0.00, 1500.00, 'Father Taaffe Homes ($400); Coats for Kids ($1,100)', 5, 1500.00, 'Approved', 1, 0.00, 1, 'CHARITABLE_DONATIONS'),
(1, '2026-2027', 'Operational', NULL, 'Roses for Easter and Mother''s Day', 0.00, 1000.00, 'Roses purchased in bulk and distributed by Knights', 5, 1000.00, 'Approved', 1, 0.00, 1, 'COMMUNITY_EVENTS'),
(1, '2026-2027', 'Operational', NULL, 'Council Knight Awards', 0.00, 700.00, 'Plaques, hammers, honorary funds', 5, 700.00, 'Approved', 1, 0.00, 1, 'MEMBERSHIP_RECOGNITION'),
(1, '2026-2027', 'Operational', NULL, 'Grand Knight Discretionary Fund', 0.00, 500.00, 'Funded by request or when an event/recipient is available. Applied by GK according to perceived needs, once/year', 5, 500.00, 'Approved', 1, 0.00, 1, 'ADMINISTRATIVE_OPERATIONS'),
(1, '2026-2027', 'Operational', NULL, 'Monthly Council Meetings', 0.00, 1500.00, 'Food & beverages: 10 meetings, ~$120/meeting, ~20 attendees', 6, 1500.00, 'Approved', 1, 0.00, 1, 'FRATERNAL_ACTIVITIES'),
(1, '2026-2027', 'Event', NULL, 'Council Camping Trip', 0.00, 1200.00, 'For campsite reservation, food, and supplies', 6, 1200.00, 'Approved', 1, 0.00, 1, 'FRATERNAL_ACTIVITIES'),
(1, '2026-2027', 'Event', NULL, 'Council Retreats (Black Butte, Lent)', 0.00, 600.00, 'Faith-building fraternal gathering with Msgr. O''Connor; 8-10 Knights', 6, 600.00, 'Approved', 1, 0.00, 1, 'FRATERNAL_ACTIVITIES'),
(1, '2026-2027', 'Event', NULL, 'Christmas Party', 0.00, 3000.00, 'Elks Lodge rental, main course, music', 6, 3000.00, 'Approved', 1, 0.00, 1, 'FRATERNAL_ACTIVITIES');
GO

-- Sprint 5Z-8: Council 15295's general ledger since the 2026-2027 fraternal year opened. Each TransactionID groups one
-- balanced posting (debits equal credits). GLAccount ids: 1 Operating Checking, 2 Goal Account #1, 3 Goal Account #2,
-- 4 General Savings, 5 Charity Savings, 6 Physical Assets, 7 Member Dues Collections, 8 Parking Fundraising, 9 General
-- Fundraising, 10 General Donations, 11 Charitable Disbursements, 12 Event Operational Costs, 13 Council Operational
-- Costs, 14 Supreme Assessments, 15 Opening Balance Equity. Checks 1119-1123 follow the expense checkbook; July's
-- bank activity is already reconciled.
INSERT INTO [JournalEntry] ([CouncilID], [GLAccountID], [DateLogged], [Description], [DebitAmount], [CreditAmount], [LinkedEventID], [LinkedMeetingID], [IsBankReconciled], [CheckNumber], [TransactionID])
VALUES
(1, 1, '2026-07-01 00:00:00', 'Opening balance carried into the ledger', 8450.00, 0.00, NULL, NULL, 1, NULL, 'seed-txn-0001'),
(1, 4, '2026-07-01 00:00:00', 'Opening balance carried into the ledger', 3200.00, 0.00, NULL, NULL, 1, NULL, 'seed-txn-0001'),
(1, 5, '2026-07-01 00:00:00', 'Opening balance carried into the ledger', 2150.00, 0.00, NULL, NULL, 1, NULL, 'seed-txn-0001'),
(1, 6, '2026-07-01 00:00:00', 'Opening balance: hall tables, banners and grill', 1875.00, 0.00, NULL, NULL, 0, NULL, 'seed-txn-0001'),
(1, 15, '2026-07-01 00:00:00', 'Opening balance carried into the ledger', 0.00, 15675.00, NULL, NULL, 0, NULL, 'seed-txn-0001'),
(1, 1, '2026-07-12 00:00:00', 'Rally free-will offering deposit', 180.00, 0.00, 1, NULL, 1, NULL, 'seed-txn-0002'),
(1, 10, '2026-07-12 00:00:00', 'Rally free-will offering deposit', 0.00, 180.00, 1, NULL, 0, NULL, 'seed-txn-0002'),
(1, 1, '2026-07-15 00:00:00', 'July member dues deposit', 1260.00, 0.00, NULL, NULL, 1, NULL, 'seed-txn-0003'),
(1, 7, '2026-07-15 00:00:00', 'July member dues deposit', 0.00, 1260.00, NULL, NULL, 0, NULL, 'seed-txn-0003'),
(1, 1, '2026-07-27 00:00:00', 'Family picnic plate sales deposit', 855.00, 0.00, 3, NULL, 1, NULL, 'seed-txn-0004'),
(1, 9, '2026-07-27 00:00:00', 'Family picnic plate sales deposit', 0.00, 855.00, 3, NULL, 0, NULL, 'seed-txn-0004'),
(1, 14, '2026-08-01 00:00:00', 'Supreme per capita assessment', 642.00, 0.00, NULL, NULL, 0, '1119', 'seed-txn-0005'),
(1, 1, '2026-08-01 00:00:00', 'Supreme per capita assessment', 0.00, 642.00, NULL, NULL, 0, '1119', 'seed-txn-0005'),
(1, 2, '2026-08-05 00:00:00', 'Set aside toward Goal Account #1', 2250.00, 0.00, NULL, NULL, 0, NULL, 'seed-txn-0006'),
(1, 1, '2026-08-05 00:00:00', 'Set aside toward Goal Account #1', 0.00, 2250.00, NULL, NULL, 0, NULL, 'seed-txn-0006'),
(1, 3, '2026-08-05 00:00:00', 'Set aside toward Goal Account #2', 600.00, 0.00, NULL, NULL, 0, NULL, 'seed-txn-0007'),
(1, 1, '2026-08-05 00:00:00', 'Set aside toward Goal Account #2', 0.00, 600.00, NULL, NULL, 0, NULL, 'seed-txn-0007'),
(1, 1, '2026-08-17 00:00:00', 'Pancake breakfast plate sales deposit', 835.00, 0.00, 4, NULL, 0, NULL, 'seed-txn-0008'),
(1, 9, '2026-08-17 00:00:00', 'Pancake breakfast plate sales deposit', 0.00, 835.00, 4, NULL, 0, NULL, 'seed-txn-0008'),
(1, 12, '2026-08-20 00:00:00', 'Pancake breakfast griddle rental and supplies', 312.40, 0.00, 4, NULL, 0, '1120', 'seed-txn-0009'),
(1, 1, '2026-08-20 00:00:00', 'Pancake breakfast griddle rental and supplies', 0.00, 312.40, 4, NULL, 0, '1120', 'seed-txn-0009'),
(1, 1, '2026-08-29 00:00:00', 'Fair parking lot proceeds deposit', 1480.00, 0.00, NULL, NULL, 0, NULL, 'seed-txn-0010'),
(1, 8, '2026-08-29 00:00:00', 'Fair parking lot proceeds deposit', 0.00, 1480.00, NULL, NULL, 0, NULL, 'seed-txn-0010'),
(1, 11, '2026-09-03 00:00:00', 'Gift to St. Jude Parish Food Pantry', 500.00, 0.00, NULL, NULL, 0, '1121', 'seed-txn-0011'),
(1, 5, '2026-09-03 00:00:00', 'Gift to St. Jude Parish Food Pantry', 0.00, 500.00, NULL, NULL, 0, '1121', 'seed-txn-0011'),
(1, 13, '2026-09-08 00:00:00', 'Parish hall rental, September meeting', 150.00, 0.00, NULL, NULL, 0, '1122', 'seed-txn-0012'),
(1, 1, '2026-09-08 00:00:00', 'Parish hall rental, September meeting', 0.00, 150.00, NULL, NULL, 0, '1122', 'seed-txn-0012'),
(1, 6, '2026-09-10 00:00:00', 'Purchased a second outdoor grill', 425.00, 0.00, NULL, NULL, 0, '1123', 'seed-txn-0013'),
(1, 1, '2026-09-10 00:00:00', 'Purchased a second outdoor grill', 0.00, 425.00, NULL, NULL, 0, '1123', 'seed-txn-0013'),
(1, 4, '2026-09-15 00:00:00', 'Transfer from Operating Checking to General Savings', 1000.00, 0.00, NULL, NULL, 0, NULL, 'seed-txn-0014'),
(1, 1, '2026-09-15 00:00:00', 'Transfer from Operating Checking to General Savings', 0.00, 1000.00, NULL, NULL, 0, NULL, 'seed-txn-0014');
GO

-- ==============================================================================
-- Sprint 5Z-Demo-Roster: executive demo logins for Council 15295 (CouncilID 1)
-- Credentials 19-21 / Member 19-21, dev password dev-pass-secure-9912 (hashed by the drivers at load, like every
-- other seed login). Plain members (MemberTypeID 3): their access comes from their seats, per the Sprint 5Z-2.5
-- executive-officer rule. They share their seats with the baseline holders (Super Admin is Grand Knight, Michael
-- O'Connor is Deputy Grand Knight, William Schmidt holds Trustee 1). Sprint 6B replaced the placeholder last names
-- with the St. Mary's officers' own (Tom McDougal, David Norman, Hector Nunez).
-- ==============================================================================
INSERT INTO [Credentials] ([Username], [Password])
VALUES
('tom.gk@kofc15295.org', 'dev-pass-secure-9912'),          -- ID 19
('david.dgk@kofc15295.org', 'dev-pass-secure-9912'),        -- ID 20
('hector.trustee@kofc15295.org', 'dev-pass-secure-9912');  -- ID 21
GO

INSERT INTO [Member] (
    [CouncilID], [MemberNumber], [MemberFirstName], [MemberLastName],
    [Phone], [StreetAddress1], [City], [State], [ZipCode], [Email],
    [DateOfBirth], [StatusID], [DegreeID], [MemberTypeID], [CredentialID]
)
VALUES
(1, 9900019, 'Tom', 'McDougal', '503-555-0119', '100 Parish Way', 'Portland', 'OR', '97201', 'tom.gk@kofc15295.org', '1970-01-01', 1, 4, 3, 19),
(1, 9900020, 'David', 'Norman', '503-555-0120', '100 Parish Way', 'Portland', 'OR', '97201', 'david.dgk@kofc15295.org', '1975-01-01', 1, 3, 3, 20),
(1, 9900021, 'Hector', 'Nunez', '503-555-0121', '100 Parish Way', 'Portland', 'OR', '97201', 'hector.trustee@kofc15295.org', '1965-01-01', 1, 4, 3, 21);
GO

INSERT INTO [MemberRoles] ([RoleID], [MemberID])
VALUES
(1, 19),  -- Grand Knight
(2, 20),  -- Deputy Grand Knight
(12, 21); -- Trustee 1 (Seed.sql has no plain 'Trustee' role)
GO

-- ==============================================================================
-- Sprint 6B: the rest of the St. Mary's Cathedral roster for the October 6, 2026 agenda (Council 15295)
-- Credentials 22-27 / Member 22-27, dev password dev-pass-secure-9912, plain members (MemberTypeID 3); contact details
-- are placeholders. Brian Wolf takes the Recorder's seat and Bill Kehrli the Treasurer's; Hector Nunez adds the
-- Membership Director's seat and Tim Ferkel takes the Community Director's. Each seat was already held by a member
-- above, so the agenda shows the newest holder (currentSeatHolder: the highest MemberRoles id). George Gurney, Alan
-- Sanchez and Matt Fife hold no seat; the agenda names them on their lines directly (SpeakerMemberID).
-- ==============================================================================
INSERT INTO [Credentials] ([Username], [Password])
VALUES
('brian.recorder@kofc15295.org', 'dev-pass-secure-9912'),    -- ID 22
('bill.treasurer@kofc15295.org', 'dev-pass-secure-9912'),    -- ID 23
('george.gurney@kofc15295.org', 'dev-pass-secure-9912'),     -- ID 24
('alan.sanchez@kofc15295.org', 'dev-pass-secure-9912'),      -- ID 25
('tim.community@kofc15295.org', 'dev-pass-secure-9912'),     -- ID 26
('matt.fife@kofc15295.org', 'dev-pass-secure-9912');         -- ID 27
GO

INSERT INTO [Member] (
    [CouncilID], [MemberNumber], [MemberFirstName], [MemberLastName],
    [Phone], [StreetAddress1], [City], [State], [ZipCode], [Email],
    [DateOfBirth], [StatusID], [DegreeID], [MemberTypeID], [CredentialID]
)
VALUES
(1, 9900022, 'Brian', 'Wolf', '503-555-0122', '100 Parish Way', 'Portland', 'OR', '97201', 'brian.recorder@kofc15295.org', '1972-01-01', 1, 4, 3, 22),
(1, 9900023, 'Bill', 'Kehrli', '503-555-0123', '100 Parish Way', 'Portland', 'OR', '97201', 'bill.treasurer@kofc15295.org', '1960-01-01', 1, 4, 3, 23),
(1, 9900024, 'George', 'Gurney', '503-555-0124', '100 Parish Way', 'Portland', 'OR', '97201', 'george.gurney@kofc15295.org', '1958-01-01', 1, 4, 3, 24),
(1, 9900025, 'Alan', 'Sanchez', '503-555-0125', '100 Parish Way', 'Portland', 'OR', '97201', 'alan.sanchez@kofc15295.org', '1978-01-01', 1, 3, 3, 25),
(1, 9900026, 'Tim', 'Ferkel', '503-555-0126', '100 Parish Way', 'Portland', 'OR', '97201', 'tim.community@kofc15295.org', '1968-01-01', 1, 3, 3, 26),
(1, 9900027, 'Matt', 'Fife', '503-555-0127', '100 Parish Way', 'Portland', 'OR', '97201', 'matt.fife@kofc15295.org', '1981-01-01', 1, 3, 3, 27);
GO

INSERT INTO [MemberRoles] ([RoleID], [MemberID])
VALUES
(4, 22),  -- Recorder
(6, 23),  -- Treasurer
(15, 21), -- Membership Director (Hector Nunez, also Trustee 1)
(16, 26); -- Community Director
GO

-- ==============================================================================
-- Sprint 5Z-Meeting-Audit: the live demo meeting (Meeting 1, CouncilID 1); Sprint 6B moved it to the St. Mary's
-- Cathedral meeting of October 6, 2026.
-- Already live (IsLiveInProgress 1) so the console opens straight onto it and members can check in. The quorum
-- roster is locked at 28, the council's Active members once the apps finish seeding (the dev seed's pre-provisioned
-- member included), the count startLiveAssemblyConsole would take.
-- No agenda item is active yet: the presenter takes the first one live, so its countdown starts on stage.
-- Tom (owner), David and Hector are invited and Accepted; Attended stays 0 until they check in.
-- ==============================================================================
INSERT INTO [Meeting] (
    [CouncilID], [Meeting Name], [Meeting Description], [Date], [Time Start], [Time End], [Location], [Agenda],
    [MinutesURL], [MeetingType], [OwnerID], [IsMultiDay], [MeetingTypeID], [IsLiveInProgress], [LiveQuorumRosterCount]
)
VALUES
(1, 'October Business Meeting', 'St. Mary''s Cathedral business meeting: live agenda, check-ins, hand votes and smartphone ballots',
 '2026-10-06', '19:30:00', '21:00:00', 'St. Mary''s Cathedral',
 'Call to Order & Opening
Chaplain''s & Officer Reports
Director & Ministry Reports
New Business
Old Business
Upcoming Events
Good of the Order',
 '', 1, 19, 0, 1, 1, 28);
GO

INSERT INTO [MeetingInvites] ([MeetingID], [MemberID], [Attended], [ResponseStatus])
VALUES
(1, 19, 0, 'Accepted'),  -- Tom, Grand Knight
(1, 20, 0, 'Accepted'),  -- David, Deputy Grand Knight
(1, 21, 0, 'Accepted');  -- Hector, Trustee 1
GO

-- ==============================================================================
-- Sprint 6B: the St. Mary's agenda of Meeting 1 (ProposedMotion 1, MeetingAgendaItem 1-16)
-- The Treasurer presents the budget changes for a hand vote under Old Business. Seated lines name a Role (GK 1,
-- DGK 2, Recorder 4, FS 5, Treasurer 6, Membership Director 15, Community Director 16, Chaplain 19) and show its
-- current holder; the Chaplain's seat is vacant, so its label 'Monsignor' prints; the State Deputy is a guest.
-- ==============================================================================
INSERT INTO [ProposedMotion] ([CouncilID], [TargetMeetingID], [SourceType], [SourceRecordID], [MotionText], [PresenterMemberID], [AllocatedMinutes], [VoteResult])
VALUES
(1, 1, 'GeneralMember', NULL, 'Vote on 2026-2027 Budget Proposed Changes', 23, 10, 'Pending');
GO

INSERT INTO [MeetingAgendaItem] ([CouncilID], [MeetingID], [SectionKey], [SortOrder], [LineMarkdown], [SpeakerRoleID], [SpeakerMemberID], [SpeakerLabel], [ProposedMotionID])
VALUES
(1, 1, 'opening', 1, '**Call to Order** - the Grand Knight opens the meeting', 1, NULL, NULL, NULL),
(1, 1, 'opening', 2, '**Opening Prayer & Pledge of Allegiance**', NULL, 24, NULL, NULL),
(1, 1, 'opening', 3, '**Roll Call of Officers** - the full officer array', 2, NULL, NULL, NULL),
(1, 1, 'opening', 4, '**Reading & Approval of the Minutes** of the September meeting', 4, NULL, NULL, NULL),
(1, 1, 'officer_reports', 1, '**Chaplain''s Report** & spiritual reflection', 19, NULL, 'Monsignor', NULL),
(1, 1, 'officer_reports', 2, '**Grand Knight''s Report**', 1, NULL, NULL, NULL),
(1, 1, 'officer_reports', 3, '**Financial Secretary''s Report**', 5, NULL, NULL, NULL),
(1, 1, 'officer_reports', 4, '**Treasurer''s Report**', 6, NULL, NULL, NULL),
(1, 1, 'officer_reports', 5, '**State Deputy''s Remarks**', NULL, NULL, 'State Deputy John Snyder', NULL),
(1, 1, 'director_reports', 1, '**Membership & Parking Report**', 15, NULL, NULL, NULL),
(1, 1, 'director_reports', 2, '**Ministry Report**', NULL, 25, NULL, NULL),
(1, 1, 'director_reports', 3, '**Community Director''s Report**', 16, NULL, NULL, NULL),
(1, 1, 'director_reports', 4, '**Ministry Report**', NULL, 27, NULL, NULL),
(1, 1, 'old_business', 1, '**Vote on 2026-2027 Budget Proposed Changes** - the Treasurer presents the revised line items', 6, NULL, NULL, 1),
(1, 1, 'good_of_order', 1, '**Prayer Requests**
- Dolores Redden
- Mark Boshears
- Paul Wolf
- Paul Della', NULL, NULL, NULL, NULL),
(1, 1, 'good_of_order', 2, '**Closing Prayer**', 19, NULL, 'Monsignor', NULL);
GO

-- ==============================================================================
-- Sprint 6L Extension 3: two open Council Prayer Intentions for Council 15295, posted by Tom (Member 19). The first
-- repeats the prayer requests on Meeting 1's agenda. No Praying Hands taps are seeded.
-- ==============================================================================
INSERT INTO [CouncilPrayerIntention] ([council_id], [author_member_id], [intention_text], [created_at]) VALUES
(1, 19, 'For the brothers and friends on our prayer list: Dolores Redden, Mark Boshears, Paul Wolf and Paul Della.', '2026-10-01 15:00:00'),
(1, 19, 'For vocations to the priesthood and religious life in our parish.', '2026-10-02 15:00:00');
GO
