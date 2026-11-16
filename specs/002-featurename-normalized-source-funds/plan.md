# Implementation Plan: Normalized Source of Funds, Dropdown Combobox & Export

**Feature**: `002-featurename-normalized-source-funds`
**Status**: In Progress

## Proposed Changes

### Phase 1: Database Normalization & Seeding
1. Create Migration: `2026_11_05_000001_add_category_and_fund_source_relationships.php`:
   - Add `category` column to `fund_sources` table.
   - Add `fund_source_id` foreign key (nullable) to `ppmps` table.
   - Add `fund_source_id` foreign key (nullable) to `ppmp_items` table.
   - Backfill existing data to link `source_of_fund` string to `fund_sources.id`.
2. Create/Update Seeder `database/seeders/FundSourceSeeder.php`:
   - Seed all 40+ Trust Fund entries from Provincial Accountant's Office (route: `pacco`, category: `Trust Fund`).
   - Seed all 8+ General & Special Fund entries (route: `budget`, category: `General Fund`).
   - Call `FundSourceSeeder` in `DatabaseSeeder.php`.
3. Update Eloquent Models:
   - `app/Models/FundSource.php`: add relationships `ppmps()`, `ppmpItems()`, fillable `category`.
   - `app/Models/Ppmp.php`: add relationship `fundSource()`.
   - `app/Models/PpmpItem.php`: add relationship `fundSource()`.

### Phase 2: Backend API & Synchronization
1. Update `app/Http/Controllers/Api/FundSourceController.php`:
   - Support category filter (`Trust Fund` | `General Fund`).
   - Provide export endpoint `/api/fund-sources/export` or client-side direct export.
   - Return detailed usage stats.
2. In `app/Http/Controllers/Api/PpmpController.php`:
   - When creating or updating PPMP or PPMP items, accept `fund_source_id` and automatically synchronize `source_of_fund` string and vice versa.

### Phase 3: Frontend Searchable Combobox Component
1. Create `resources/js/components/PPMP/SourceOfFundCombobox.jsx`:
   - Uses `createPortal(..., document.body)` with dynamic viewport position calculation (`updatePosition`).
   - High z-index (`z-[99999]`) and zero table overflow clipping.
   - Live search by name, code, category, or workflow route.
   - Category filter tabs (`All`, `General Funds (Budget)`, `Trust Funds (PACCO)`).
   - Dynamic substitution of `(customize year e.g, 2026)` with PPMP's actual fiscal year.
   - Custom text entry mode support.
2. Integrate in `resources/js/components/PPMP/ProcurementPlanTable.jsx`:
   - Replace the plain `<textarea>` in the `Source of Funds` column with `<SourceOfFundCombobox />`.
3. Integrate in `resources/js/pages/PPMP/PPMPFormPage.jsx`:
   - Header fund source selector supports the normalized combobox.

### Phase 4: Admin/Super Admin Management & Excel/PDF Export
1. Update `resources/js/components/Dashboard/FundSourcesManagement.jsx`:
   - Add "Export Excel" button: exports `.csv` / `.xlsx` with all fields, category, route, and PPMP counts.
   - Add "Export PDF / Print" button: opens official printable document modal with Province and Provincial Accountant's Office header and clean tabular layout.
   - Category selector in Add/Edit modal.

### Phase 5: Verification & Automated Tests
1. Write Feature Tests:
   - Migration and foreign key integrity test.
   - Seeder verification test checking all entries exist with proper categories and routes.
   - Controller CRUD and export test.
2. Run full test suite: `php artisan test`.
3. Build assets: `npm run build`.
