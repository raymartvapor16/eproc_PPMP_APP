# Tasks: Supplemental Continuation PPMP Workflow

**Feature**: `003-featurename-supplemental-continuation`  
**Status**: Ready to Implement  

## Tasks

- [x] Task 1: Create database migration `2026_11_05_000002_add_supplemental_continuation_support_to_ppmps.php` to add `requested_supplemental_purpose`, `requested_supplemental_specify`, `supplemental_purpose`, `supplemental_purpose_specify` to `ppmp_amendments`, and `is_continuation`, `baseline_annual_budget` to `ppmps`.
- [x] Task 2: Update `app/Models/Ppmp.php` and `app/Models/PpmpAmendment.php` with fillable attributes, casts, and relationship methods for continuation support and root annual budget helper.
- [x] Task 3: Update `app/Http/Controllers/Api/PpmpWorkflowController.php` in `requestAmendmentOrSupplemental` to accept and validate `supplemental_purpose` and `supplemental_specify`.
- [x] Task 4: Update `app/Http/Controllers/Api/PpmpWorkflowController.php` in `approveAmendmentRequest` to handle `CONTINUATION` vs `OTHER`:
  - When `CONTINUATION`: set `is_continuation = true`, `fiscal_year = date('Y')`, clear item `start_date`, `end_date`, `delivery_period`, and `estimated_budget = null`.
  - When `OTHER`: copy all item cells as-is from baseline annual PPMP.
- [x] Task 5: Add budget ceiling validation and item cell completion validation in `PpmpWorkflowController::submitToHead` / `submitToReviewer` and `PpmpController::update`.
- [x] Task 6: Update `resources/js/pages/PPMP/PPMPDetailPage.jsx` modal to include "For continuation" vs "Other: [specify]" selection under Supplemental, and display continuation status banner.
- [x] Task 7: Update `resources/js/pages/PPMP/PPMPFormPage.jsx` to enforce budget ceiling limit display/warnings and prevent submission if continuation cells are incomplete.
- [x] Task 8: Create automated feature test `tests/Feature/SupplementalContinuationTest.php` covering the request modal options, continuation approval, cell nulling, budget limit enforcement, and submission validation.
- [x] Task 9: Execute full test suite `php artisan test` and `npm run build` to verify 100% pass rate.
