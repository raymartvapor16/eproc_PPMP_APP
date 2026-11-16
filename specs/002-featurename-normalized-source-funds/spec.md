# Feature Specification: Normalized Source of Funds Management, Dropdown & Export

**Feature Branch**: `002-featurename-normalized-source-funds`
**Created**: 2026-11-05
**Status**: Ready for Planning
**Input**: User description: "Please implement the source of funds table with relationship on the ppmp table(normalize database), then update the create/edit ppmp this must input search dropdown and please must not overflow and setup z-index, this is for Trust Funds and General funds and etc. for budget, the data is on that excel I provided, please implement also this management on the admin and super admin and this can be download or export excel/pdf file. Please make no mistakes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Normalized Database Architecture & Seeding (Priority: P1)
As an administrative or end user, all Source of Funds entries must be normalized in a dedicated `fund_sources` table linked via foreign key `fund_source_id` on both `ppmps` and `ppmp_items` tables, while preserving backward compatibility with `source_of_fund` string references.

**Why this priority**: Essential relational integrity for budgeting, reporting, and PACCO vs Budget Officer workflow routing.

**Independent Test**:
- Can run migrations to add `fund_source_id` to `ppmps` and `ppmp_items`.
- Run database seeder to populate all Trust Funds and General Funds from Provincial Accountant's Office Excel list.
- Verify Eloquent relationships: `$ppmp->fundSource` and `$fundSource->ppmps`.

**Acceptance Scenarios**:
1. **Given** existing PPMP records, **When** migration runs, **Then** `fund_source_id` foreign keys exist and populate matching IDs from `fund_sources`.
2. **Given** the 40+ Trust Fund entries and 8+ General Fund entries, **When** `FundSourceSeeder` executes, **Then** all entries are inserted with proper `workflow_route` (`pacco` for Trust Funds, `budget` for General Funds) and `category`.

---

### User Story 2 - Non-Overflowing Searchable Dropdown (Combobox) on PPMP (Priority: P1)
As a PPMP preparer (End User), when adding or editing items in the PPMP table, the Source of Funds input must be a searchable dropdown (combobox) that renders through a React Portal (`createPortal(..., document.body)`) with high z-index (`z-[99999]`) so it never gets clipped by table overflow boundaries.

**Why this priority**: Directly resolves UI issue in `media_1793846704627_ee8a7d80.png` where the cell has a plain textarea.

**Independent Test**:
- In PPMP Create/Edit table, click on Source of Funds cell.
- Combobox opens floating above table borders, calculates viewport position, filters by query, and selects fund cleanly.

**Acceptance Scenarios**:
1. **Given** PPMP table items, **When** user clicks Source of Funds, **Then** a searchable dropdown opens above the table with tab filters for "All", "General Funds", and "Trust Funds".
2. **Given** horizontal or vertical scrolling on the table, **When** dropdown is opened, **Then** the dropdown does not cause layout overflow or get clipped by table scroll containers.
3. **Given** custom fiscal year entries (e.g. `(customize year e.g, 2026)`), **When** loaded on a PPMP with FY 2026, **Then** it automatically substitutes the actual PPMP fiscal year cleanly.

---

### User Story 3 - Admin/Super Admin Management with Excel/PDF Export (Priority: P2)
As an Administrator or Super Administrator, I can manage (add, edit, activate/deactivate, delete) all Sources of Fund and export/download the entire list as an Excel spreadsheet (.xlsx/csv) or an official printable PDF document.

**Why this priority**: Required for accounting and administrative governance of provincial funds.

**Independent Test**:
- Visit Admin Dashboard -> Sources of Fund tab.
- Click "Export Excel" -> downloads structured spreadsheet.
- Click "Export PDF" / Print -> renders official Provincial government formatted report.

**Acceptance Scenarios**:
1. **Given** admin user, **When** clicking "Export to Excel", **Then** browser triggers download of `.xlsx` or `.csv` with all columns and usage statistics.
2. **Given** admin user, **When** clicking "Export PDF / Print", **Then** formatted printable document displays with Provincial Accountant Office header.
3. **Given** fund source with existing PPMPs, **When** attempting deletion, **Then** system protects referential integrity and prompts deactivation instead.

---

## Technical & Schema Design Requirements
1. **Database Columns**:
   - `fund_sources`: `id`, `name`, `code`, `workflow_route` (`budget` | `pacco`), `category` (`Trust Fund` | `General Fund` | `Special Fund`), `description`, `is_active`, `display_order`, timestamps.
   - `ppmps`: add `fund_source_id` nullable foreign key to `fund_sources(id)`.
   - `ppmp_items`: add `fund_source_id` nullable foreign key to `fund_sources(id)`.
2. **UI Component**:
   - `resources/js/components/PPMP/SourceOfFundCombobox.jsx` using `createPortal` and floating coordinates.
3. **Admin Management & Export**:
   - Update `resources/js/components/Dashboard/FundSourcesManagement.jsx` with Excel and PDF export tools.
