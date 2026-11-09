# Software Engineering Lab - Team 10

## Team

| SRN | Name | Mini project role |
|---|---|---|
| PES1UG24AM123 | Jayanth K | Dev Lead |
| PES1UG24AM162 | Mohammad Bilal A | QA Lead, Developer |
| PES1UG24AM139 | Kishore V | Developer |
| PES1UG24AM148 | Leeladhar G Sairaju | Developer |

Course: Software Engineering (Semester 5), PES University.

## Labs

Each lab folder holds one sub-folder per team member, named by the last digits of the SRN (for example `Lab_04/AM162`).

| Folder | Topic |
|---|---|
| `Lab_01` | Use case flows, functional and non-functional requirements, UML diagram |
| `Lab_02` | Agile planning in Jira (epics, stories, sprints) |
| `Lab_03` | Component diagram and architecture justification |
| `Lab_04` | Prompt-driven code enhancement, with before and after recordings |
| `Lab_05` | Static code analysis (Pylint, Flake8, Bandit) and fixes |
| `Lab_06` | Code coverage and branch coverage testing |
| `Lab_07` | Fuzz testing |

## Mini Project: Student Club Event Ticketing & Budget Portal

### Problem statement

Student clubs plan events through paper forms and email. A proposal has to pass the Faculty Coordinator, the Finance Officer and the Dean, and nobody can easily see where it is stuck or why it was rejected. Once an event is approved, entry is handled with manual lists, so tickets can be shared or reused and attendance is hard to report.

The portal replaces this with one web application:

- Club Leads submit event proposals with a budget and track their status.
- Proposals go through a fixed three-stage approval: Faculty Coordinator, then Finance Officer, then Dean. Each decision is recorded with a comment.
- Users get in-app notifications when a proposal changes status.
- Approved proposals are published as events. Students register for free and get a unique, signed QR ticket that they can open at any time from My Tickets.
- At the venue, Club Leads check tickets in. Each ticket works once; reused, forged and wrong-event tickets are rejected.
- The Campus Admin sees a dashboard of the approval pipeline and exports budget and attendance reports as CSV.

### Roles

| Role | What they do |
|---|---|
| Club Lead | Submits and edits proposals, tracks status, checks tickets in, sees the dashboard for their own club |
| Faculty Coordinator, Finance Officer, Dean | Approve or reject proposals at their stage, view approval history |
| Campus Admin | Dashboard for all clubs, CSV report export |
| Student | Browses approved events, registers, views QR tickets |

### Technology

- Client: React 18 with Vite, React Router, Axios
- Server: Node.js 20 with Express, layered as routes, services and repositories
- Database: MySQL 8, accessed only through parameterised queries
- Security: bcrypt password hashing, JWT authentication, role checks on every protected API, HMAC-SHA256 signed tickets
- Testing: Jest and Supertest; GitHub Actions runs the server tests and the client build on every push and pull request

### Directory structure

```
Mini_project/
  client/                     React single-page application
    src/
      api.js                  Single Axios instance; attaches the JWT to every call
      App.jsx                 Page list: one entry creates the route and the role-based menu link
      auth/                   Login state, protected routes, role constants
      components/Layout.jsx   Top bar and menu
      pages/                  One file per screen (proposals, approvals, events, tickets, check-in, dashboard)
  server/                     Express REST API
    db/
      schema.sql              Tables: users, clubs, proposals, approval_history, notifications,
                              registrations, tickets, checkins
      migrate.js              Creates the database and any missing tables
      seed.js                 Demo clubs, one user per role, approved demo events
    src/
      app.js                  Express app and route mounting
      server.js               Starts the HTTP server
      middleware/auth.js      JWT check (401) and role check (403)
      routes/                 Request validation and HTTP responses, no SQL
      services/               Business rules (approval stages, tickets, check-in, reports)
      repositories/           All SQL, parameterised
    tests/                    Jest and Supertest suites, named after Test Plan case IDs
  docs/                       SRS, SAD, Test Plan, test reports, sprint burndown charts and demo videos
.github/workflows/ci.yml      CI: server tests and client build
```

### Running locally

Requirements: Node.js 20 or later and MySQL 8.

1. Install dependencies:
   ```
   cd Mini_project/server && npm install
   cd ../client && npm install
   ```
2. Set the server settings as environment variables (see `server/.env.example` for the full list): `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET` and `QR_HMAC_SECRET`.
3. Create the tables and load the demo data, then start the API on port 3000:
   ```
   cd Mini_project/server
   npm run migrate
   npm run seed
   npm start
   ```
4. In a second terminal, start the client on http://localhost:5173:
   ```
   cd Mini_project/client
   npm run dev
   ```
5. Sign in with any seeded account, for example `lead.a@college.edu`, `faculty@college.edu`, `admin@college.edu` or `student1@college.edu`. All demo accounts use the password `Test@123`.

Run the automated tests with `npm test` in `Mini_project/server`.

### Documents

All project documents are in `Mini_project/docs`:

| Document | Contents |
|---|---|
| `SRS_Student_Club_Portal.docx` | Software Requirements Specification: 15 functional requirements, non-functional and security requirements |
| `SAD_Student_Club_Portal.docx` | Software Architecture Document: components, data model, API |
| `Test_Plan_Student_Club_Portal.docx` | Test strategy, environment, schedule and 26 test cases |
| `Unit_Test_Report_Student_Club_Portal.docx` | Results of the 258 automated unit and API tests |
| `System_Validation_Report_Student_Club_Portal.docx` | End-to-end validation of all Test Plan cases against the running system |
| `Code_Coverage_Report_Student_Club_Portal.docx` | Statement, line and function coverage |
| `Branch_Coverage_Report_Student_Club_Portal.docx` | Branch coverage with uncovered lines |
| Burndown charts and demo videos | Sprint 1, 2 and 3 progress and demos |

### Project management

Work was planned in Jira (project SCP) over three one-week sprints. Each user story was built on its own branch named after its Jira key (for example `SCP-23-event-list-page`) and merged into `main` through a reviewed pull request with passing CI.
