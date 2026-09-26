🟦 Knights of Columbus Unified Tracking Platform
Welcome to the Knights of Columbus Event Tracking and Fraternal Management Platform. This full-stack monorepo houses a phone-optimized mobile application for individual Brother Knights and a dense administrative desktop web dashboard for Council Officers and Super Admins.
The architecture is built completely around a central database service abstraction layer, allowing for local offline-first development using Expo SQLite and In-Memory arrays, while maintaining a 1:1 translation mapping layer ready for deployment to Microsoft Azure SQL Server via T-SQL.
________________________________________
🎨 1. Corporate Identity & Branding Guardrails
Both applications are strictly locked to the official Knights of Columbus corporate design manual parameters. Compliance is automatically monitored by an integrated automated style sweep test suite (tests/web-theme.test.ts).
•	Primary Corporate Navy (#002855): Applied across all base app containers, top navigation toolbars, action buttons, and side panel grids.
•	Secondary Liturgical Red (#C8102E): Used strictly for high-visibility metrics, shift requirements, 24-hour urgency alerts, and the 1-Year Rolling No-Show Badge Tally.
•	Accent Fraternal Gold (#D6A420): Used exclusively for highlighting active selections, calendar milestones, and high-priority volunteer openings.
•	Universal Background Layouts: Set to flat White (#FFFFFF) to guarantee clear contrast ratios across all panels.
•	Typography Hierarchy: Large page headers default to Georgia (Serif Bold), while all input fields, data rows, tables, and messaging streams force Arial (sans-serif).
________________________________________
🗄️ 2. Core Architecture & Local Data Engines
The repository separates layers cleanly to allow database migrations without changing frontend code:
text
kofc-tracking-platform/
├── packages/shared/          # Central DataService Contracts, Notifications, & Rule Guards
├── apps/mobile/              # Expo Router v3 Phone Client Engine (SQLite Driver)
└── apps/web/                 # Next.js App Router Administrative Desktop Portal (In-Memory Mock)
Use code with caution.
🛡️ Runtime Business Rule Validation Guards
Every transactional write passes through a central, pure validation gate (packages/shared/src/rules.ts) backed by 257 passing automated unit tests:
1.	15-Minute Rule: All logged time entries must be exact decimal multiples of 0.25 hours (e.g., 0.25, 0.50, 1.75). Rogue fractions (like 1.33) are automatically rejected.
2.	Activity Safety Lock: General activity logs or historical tracking updates cannot be backdated further than 6 months.
3.	Shift Safety Lock: Retrospective time logs against completed events or volunteer shifts cannot be backdated further than 3 months from the ShiftDate.
4.	Atomic Volunteer Cap: Once a shift's NumberVolunteersSignedUp reaches its MinNumberVolunteers requirement, the system automatically triggers a race-safe capacity lock. The shift is immediately locked, blocking further signups.
________________________________________
💻 3. Local Development Server Execution
To test the application layouts locally on your computer using your pre-seeded data metrics, use your terminal window to execute your local servers.
🖥️ A. Running the Next.js Admin Desktop Portal
1.	Open your Windows PowerShell window inside your project folder.
2.	Type this exact script command and hit Enter:
bash
npm run dev:web
Use code with caution.
3.	Open your internet web browser and navigate to: http://localhost:3000
4.	Log in using any of these pre-configured testing developer profiles (Password for all accounts is koc15295):
o	Super Admin Portal: testsuperadmin@kofc.org (Accesses lookups, roles, and global tabs)
o	Council Admin Portal: testadmin@kofc.org (Accesses split-screen event planners and meeting setups)
📱 B. Running the Expo Mobile Phone App
1.	Ensure you have the free Expo Go application installed on your iPhone or Android phone.
2.	Ensure your computer and your phone are connected to the same Wi-Fi network.
3.	In a separate terminal panel window, execute the mobile server command:
bash
npm run dev:mobile
Use code with caution.
4.	A large interactive QR code will render directly in your terminal text box.
5.	Point your phone's standard camera app at the screen to scan the QR code. The app will open instantly via Expo Go, streaming changes from your desktop in real-time. Log in using testmember@kofc.org to view your personalized dashboard!
________________________________________
☁️ 4. GitHub Actions CI/CD Pipeline Tracking
Every time you execute a standard code save to the cloud, your online automation system verifies your repository health:
bash
git push -u origin main
Use code with caution.
The cloud runner handles your project verification across three discrete pipeline stages:
1.	Shared Workspace Compiler: Installs dependencies and builds @kofc/shared packages cleanly.
2.	Logic Unit Test Execution: Executes all 257 automated validation tests using a virtual SQLite translation engine to ensure no business logic walls are broken.
3.	App Manifest Interceptor: Validates that your Next.js file routes and Expo directory components parse cleanly without syntax breaking blocks.
________________________________________

