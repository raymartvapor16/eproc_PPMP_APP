# Tasks: Normalized Source of Funds, Dropdown Combobox & Export

**Feature**: `002-featurename-normalized-source-funds`
**Status**: Ready to Implement

## Tasks

- [ ] Task 1: Create database migration `2026_11_05_000001_add_category_and_fund_source_relationships.php` adding `category` to `fund_sources`, and `fund_source_id` foreign keys to `ppmps` and `ppmp_items`.
- [ ] Task 2: Create `database/seeders/FundSourceSeeder.php` with all 40+ Trust Funds (PACCO) and General/Special Funds (Budget) from Provincial Accountant's Office Excel list.
- [ ] Task 3: Update `app/Models/FundSource.php`, `app/Models/Ppmp.php`, and `app/Models/PpmpItem.php` with foreign key relationships and fillable attributes.
- [ ] Task 4: Update `app/Http/Controllers/Api/FundSourceController.php` with category support, filtering, and export capability.
- [ ] Task 5: Update `app/Http/Controllers/Api/PpmpController.php` to handle `fund_source_id` synchronization.
- [ ] Task 6: Build `resources/js/components/PPMP/SourceOfFundCombobox.jsx` using `createPortal(..., document.body)` with floating positioning, category tabs, and high z-index.
- [ ] Task 7: Integrate `SourceOfFundCombobox` in `resources/js/components/PPMP/ProcurementPlanTable.jsx` to replace the textarea in the Source of Funds column.
- [ ] Task 8: Integrate `SourceOfFundCombobox` in `resources/js/pages/PPMP/PPMPFormPage.jsx` for header fund source selection.
- [ ] Task 9: Update `resources/js/components/Dashboard/FundSourcesManagement.jsx` with Excel and PDF export features, category selection, and printable layout.
- [ ] Task 10: Create automated feature test `tests/Feature/NormalizedFundSourceTest.php` covering schema, relationships, seeding, and API behavior.
- [ ] Task 11: Execute `php artisan test` and `npm run build` to verify 100% pass rate.

