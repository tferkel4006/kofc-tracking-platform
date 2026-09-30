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
('Lecturer', 0),
('Trustee 1', 1),
('Trustee 2', 1),
('Trustee 3', 1),
('Membership Director', 0),
('Community Director', 0),
('Program Director', 0),
('Family Director', 0),
('Chaplain', 0),
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
-- @presentation-data
-- Everything below this marker is presentation data. The apps load it (presentationData: true); the automated
-- tests keep the minimal baseline above, so their fixture ids, vacant seats and empty ledgers stay stable.
-- ==============================================================================
-- Sprint 5Z-1: high-fidelity presentation data for Council 15295 (CouncilID 1)
-- Fifteen members seated across the officer and director roles (Credentials 4-18, Member 4-18, all with the dev
-- password dev-pass-secure-9912), ten reimbursed expense sheets, eight charity checks and five intake requests in the vetting
-- pipeline. Payouts fall between October 2025 and August 2026. Check numbers 1101-1118 are the council's checkbook.
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
    [DateOfBirth], [StatusID], [DegreeID], [MemberTypeID], [CredentialID]
)
VALUES
(1, 4817263, 'Michael', 'O''Connor', '503-555-0142', '2215 NE Klickitat St', 'Portland', 'OR', '97212', 'michael.oconnor@kofc15295.org', '1968-03-14', 1, 4, 3, 4),
(1, 5120938, 'James', 'Delgado', '503-555-0187', '4410 SE Woodstock Blvd', 'Portland', 'OR', '97206', 'james.delgado@kofc15295.org', '1975-07-22', 1, 3, 3, 5),
(1, 5388201, 'Patrick', 'Nguyen', '503-555-0123', '918 SW Vista Ave', 'Portland', 'OR', '97205', 'patrick.nguyen@kofc15295.org', '1982-11-02', 1, 3, 3, 6),
(1, 4290115, 'Thomas', 'Kowalski', '503-555-0164', '7336 N Lombard St', 'Portland', 'OR', '97203', 'thomas.kowalski@kofc15295.org', '1961-05-09', 1, 4, 3, 7),
(1, 5602774, 'Robert', 'Fitzgerald', '503-555-0118', '1507 NE Tillamook St', 'Portland', 'OR', '97212', 'robert.fitzgerald@kofc15295.org', '1979-01-27', 1, 3, 3, 8),
(1, 5741390, 'Anthony', 'Russo', '503-555-0171', '3620 SE Belmont St', 'Portland', 'OR', '97214', 'anthony.russo@kofc15295.org', '1987-09-18', 1, 3, 3, 9),
(1, 6013456, 'Daniel', 'Mbeki', '503-555-0139', '5104 NE Sandy Blvd', 'Portland', 'OR', '97213', 'daniel.mbeki@kofc15295.org', '1991-04-05', 1, 2, 3, 10),
(1, 6128873, 'Joseph', 'Hernandez', '503-555-0156', '8825 SE Powell Blvd', 'Portland', 'OR', '97266', 'joseph.hernandez@kofc15295.org', '1994-12-11', 1, 1, 3, 11),
(1, 3987412, 'Francis', 'Byrne', '503-555-0102', '2830 SW Patton Rd', 'Portland', 'OR', '97201', 'francis.byrne@kofc15295.org', '1955-08-30', 1, 4, 3, 12),
(1, 4105629, 'William', 'Schmidt', '503-555-0195', '6419 SW Capitol Hwy', 'Portland', 'OR', '97239', 'william.schmidt@kofc15295.org', '1958-02-16', 1, 4, 3, 13),
(1, 4632087, 'George', 'Alvarez', '503-555-0148', '1122 NE 64th Ave', 'Portland', 'OR', '97213', 'george.alvarez@kofc15295.org', '1964-10-04', 1, 3, 3, 14),
(1, 5519024, 'Peter', 'Lindqvist', '503-555-0177', '4027 N Williams Ave', 'Portland', 'OR', '97227', 'peter.lindqvist@kofc15295.org', '1983-06-21', 1, 3, 3, 15),
(1, 5876310, 'Matthew', 'Okafor', '503-555-0131', '2718 SE Division St', 'Portland', 'OR', '97202', 'matthew.okafor@kofc15295.org', '1989-03-08', 1, 3, 3, 16),
(1, 5933847, 'Stephen', 'Tran', '503-555-0184', '9310 SW Barbur Blvd', 'Portland', 'OR', '97219', 'stephen.tran@kofc15295.org', '1986-12-29', 1, 3, 3, 17),
(1, 6245501, 'Christopher', 'Walsh', '503-555-0169', '1645 NW Kearney St', 'Portland', 'OR', '97209', 'christopher.walsh@kofc15295.org', '1998-07-15', 1, 2, 3, 18);
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
INSERT INTO [Event] ([EventName], [EventDescription], [OwnerID], [StartDate], [EndDate], [Location], [CategoryID], [Budget], [Spend], [FundsRaised-Cash], [FundsRaised-Electronic], [Highlights], [PlannedNumberAttendees], [ActualNumberAttendees], [IsAnnual], [IsMultiDay], [MissionAreaID])
VALUES
('Rosary Rally at the Parish Grotto', 'Public rosary for peace with the Knights leading the decades', 4, '2026-07-12', '2026-07-12', 'St. Jude Parish Grotto', 3, 60.00, 45.00, 180.00, 0.00, 'Over ninety parishioners prayed all five decades despite the heat.', 80, 94, 0, 0, 1),
('Holy Hour for Vocations', 'Eucharistic adoration praying for priestly and religious vocations', 5, '2026-09-10', '2026-09-10', 'St. Jude Church', 3, 25.00, 20.00, 95.00, 0.00, 'Two seminarians joined us and spoke after Benediction.', 40, 37, 0, 0, 1),
('Parish Family Picnic', 'Summer picnic with games, a bounce house and a Knights grill line', 16, '2026-07-26', '2026-07-26', 'Laurelhurst Park, Picnic Area B', 1, 450.00, 410.00, 640.00, 215.00, 'Record turnout; the grill line served 310 plates.', 250, 312, 1, 0, 2),
('Back-to-School Pancake Breakfast', 'Pancake breakfast raising school-supply money for parish families', 15, '2026-08-16', '2026-08-16', 'St. Jude Parish Hall', 5, 300.00, 265.00, 525.00, 310.00, 'Funded forty backpacks for the school drive.', 180, 205, 1, 0, 2),
('Tootsie Roll Drive for Special Olympics', 'Annual candy drive at grocery stores for people with intellectual disabilities', 18, '2026-08-22', '2026-08-22', 'Fred Meyer and Safeway entrances, NE Portland', 5, 75.00, 60.00, 1120.50, 260.00, 'Our best drive in five years.', 0, 0, 1, 0, 3),
('Food Pantry Restock Day', 'Sorting and shelving donated groceries at the parish pantry', 17, '2026-09-12', '2026-09-12', 'St. Jude Parish Food Pantry', 2, 0.00, 0.00, 150.00, 0.00, 'Restocked every shelf before the fall rush.', 0, 0, 0, 0, 3),
('Baby Bottle Campaign Kickoff', 'Baby bottles handed out after every Mass to collect change for the pregnancy center', 14, '2026-07-19', '2026-07-19', 'St. Jude Church narthex', 5, 150.00, 120.00, 865.25, 400.00, 'Six hundred bottles went home with families.', 500, 600, 1, 0, 4),
('Pregnancy Center Nursery Painting', 'Painting and furnishing the nursery at Holy Family Pregnancy Resource Center', 13, '2026-09-19', '2026-09-19', 'Holy Family Pregnancy Resource Center', 2, 200.00, 185.00, 0.00, 0.00, 'The nursery reopened the following Monday.', 0, 0, 0, 0, 4);
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

-- Sprint 5Z-2: the council's approved 2026-2027 budget lines a vetter may name as a request's target (BudgetCategoryID 1-6
-- are the six funds above: 2 Sister Rita Rose Vistica Parish Community Fund, 3 Cathedral School & Student Support, 4 Other
-- Donations & Projects).
INSERT INTO [CouncilBudgetForecast] ([CouncilID], [FraternalYear], [CategoryType], [ReferenceSourceID], [LineItemName], [PrePopulatedAmount], [ApprovedBudgetAmount], [Notes], [BudgetCategoryID], [ProposedBudgetAmount], [BudgetStatus])
VALUES 
(1, '2026-2027', 'Donation', 1, 'St. Jude Parish Food Pantry', 1000.00, 1500.00, NULL, 2, 1500.00, 'Approved'),
(1, '2026-2027', 'Donation', 2, 'Holy Family Pregnancy Resource Center', 1350.00, 1500.00, NULL, 4, 1500.00, 'Approved'),
(1, '2026-2027', 'Donation', 4, 'Cathedral School Tuition Assistance Fund', 1000.00, 1200.00, NULL, 3, 1200.00, 'Approved'),
(1, '2026-2027', 'Operational', NULL, 'Outside Organization Requests', 0.00, 5000.00, 'Pool for vetted intake requests', 4, 5000.00, 'Approved');
GO
