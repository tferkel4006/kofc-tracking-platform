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
-- Adds testadmin, testsuperadmin, and testmember profiles with password: koc15295
-- =========================================================================

-- 1. Create a Default Baseline Council for Testing
INSERT INTO [Council] ([CouncilNumber], [CouncilName], [State], [Phone], [Email])
VALUES (15295, 'St. Jude Council', 'OR', '503-555-0199', 'kofc15295@gmail.com');
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
-- password koc15295), ten reimbursed expense sheets, eight charity checks and five intake requests in the vetting
-- pipeline. Payouts fall between October 2025 and August 2026. Check numbers 1101-1118 are the council's checkbook.
-- ==============================================================================
INSERT INTO [Credentials] ([Username], [Password])
VALUES
('michael.oconnor@kofc15295.org', 'koc15295'),   -- ID 4
('james.delgado@kofc15295.org', 'koc15295'),     -- ID 5
('patrick.nguyen@kofc15295.org', 'koc15295'),    -- ID 6
('thomas.kowalski@kofc15295.org', 'koc15295'),   -- ID 7
('robert.fitzgerald@kofc15295.org', 'koc15295'), -- ID 8
('anthony.russo@kofc15295.org', 'koc15295'),     -- ID 9
('daniel.mbeki@kofc15295.org', 'koc15295'),      -- ID 10
('joseph.hernandez@kofc15295.org', 'koc15295'),  -- ID 11
('francis.byrne@kofc15295.org', 'koc15295'),     -- ID 12
('william.schmidt@kofc15295.org', 'koc15295'),   -- ID 13
('george.alvarez@kofc15295.org', 'koc15295'),    -- ID 14
('peter.lindqvist@kofc15295.org', 'koc15295'),   -- ID 15
('matthew.okafor@kofc15295.org', 'koc15295'),    -- ID 16
('stephen.tran@kofc15295.org', 'koc15295'),      -- ID 17
('christopher.walsh@kofc15295.org', 'koc15295'); -- ID 18
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
INSERT INTO [ExpenseReport] ([CouncilID], [SubmitterMemberID], [Status], [DisbursementID])
VALUES
(1, 4, 'Reimbursed', 1),
(1, 15, 'Reimbursed', 2),
(1, 16, 'Reimbursed', 3),
(1, 6, 'Reimbursed', 4),
(1, 15, 'Reimbursed', 5),
(1, 17, 'Reimbursed', 6),
(1, 16, 'Reimbursed', 7),
(1, 5, 'Reimbursed', 8),
(1, 18, 'Reimbursed', 9),
(1, 16, 'Reimbursed', 10);
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
(10, '2026-08-07', 119.99, 'Target', 'Backpacks and school supplies');
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
    [VetterMemberID], [VettingNotes], [VettedDate], [VoteStatus], [AmountApproved]
)
VALUES
(1, 'St. Jude Youth Ministry', 'Kevin Brandt', '503-555-0301', 'youth@stjudeparish.org', 800.00, 'Submitted', '2026-09-14 19:22:00',
 15, '5200 NE Alameda St, Portland, OR 97213', 1, 0, NULL, 'https://stjudeparish.org/youth', 'Forming high-school students in faith and service', 0,
 '2026-10-31 00:00:00', 'Bus rental and registration for the diocesan youth rally', 'Thirty parish teens', 'Receipts and a photo report to the council', 1,
 NULL, NULL, NULL, 'Pending', 0.00),
(1, 'Portland Refugee Welcome Network', 'Amina Yusuf', '503-555-0318', 'amina@prwn.org', 1500.00, 'Submitted', '2026-09-21 20:05:00',
 18, '2250 SE 82nd Ave, Portland, OR 97216', 5, 1, NULL, 'https://prwn.org', 'Resettling refugee families arriving in Portland', 0,
 '2026-11-15 00:00:00', 'Starter kitchen kits for five newly arrived families', 'Five refugee families', 'Itemized purchase list and thank-you letters', 2,
 NULL, NULL, NULL, 'Pending', 0.00),
(1, 'Cathedral School Robotics Club', 'Joan Pratt', '503-555-0325', 'robotics@cathedralschoolpdx.org', 650.00, 'Claimed by Trustee', '2026-08-26 18:40:00',
 17, '110 NW 17th Ave, Portland, OR 97209', 2, 0, NULL, 'https://cathedralschoolpdx.org', 'STEM enrichment for Catholic middle-schoolers', 1,
 '2026-10-10 00:00:00', 'Competition registration and replacement parts', 'Twelve seventh and eighth graders', 'Club treasurer reports spending at the November meeting', 1,
 12, 'Called the principal; the club is school-sponsored. Asked for last year''s budget.', NULL, 'Pending', 0.00),
(1, 'Gabriel House Maternity Home', 'Rebecca Moore', '503-555-0337', 'rmoore@gabrielhouse.org', 2500.00, 'Claimed by Trustee', '2026-08-18 21:15:00',
 4, '4730 SE Hawthorne Blvd, Portland, OR 97215', 3, 1, NULL, 'https://gabrielhouse.org', 'A home for pregnant women facing homelessness', 1,
 '2026-12-01 00:00:00', 'Crib and car-seat replacements for the nursery', 'Eight mothers and their newborns', 'Invoices plus a site visit by the vetter', 2,
 13, 'Confirmed 501(c)(3) status. Site visit booked for October 3.', NULL, 'Pending', 0.00),
(1, 'Portland Metro Special Olympics Teams', 'Chris Dunn', '503-555-0349', 'coach@pdxmetroathletes.org', 1000.00, 'Advanced', '2026-07-29 17:55:00',
 16, '6400 SE Lake Rd, Milwaukie, OR 97222', 6, 1, NULL, 'https://pdxmetroathletes.org', 'Year-round sports training for athletes with intellectual disabilities', 1,
 '2026-10-20 00:00:00', 'Uniforms for the fall bocce and basketball teams', 'Forty metro-area athletes', 'Team photo and roster sent to the council', 2,
 14, 'Long-standing Knights partner program; financials reviewed. Recommend the full amount.', '2026-09-02 20:30:00', 'Pending', 0.00);
GO
