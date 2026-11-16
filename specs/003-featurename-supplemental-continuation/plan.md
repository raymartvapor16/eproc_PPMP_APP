# Implementation Plan: Supplemental Continuation PPMP Workflow

**Feature**: `003-featurename-supplemental-continuation`  
**Status**: In Progress  

## Architecture Overview
1. **Database Schema**:
   - Migration `2026_11_05_000002_add_supplemental_continuation_support_to_ppmps.php`:
     - Adds `requested_supplemental_purpose` and `requested_supplemental_specify` to `ppmp_amendments`.
     - Adds `supplemental_purpose` and `supplemental_purpose_specify` to `ppmp_amendments`.
     - Adds `is_continuation` (boolean, default false) and `baseline_annual_budget` (decimal(15,2), nullable) to `ppmps`.
   - Update `app/Models/Ppmp.php` and `app/Models/PpmpAmendment.php` fillable and magic accessors.
2. **Backend Controller Updates**:
   - `PpmpWorkflowController::requestAmendmentOrSupplemental`:
     - Accepts `supplemental_purpose` (`CONTINUATION` | `OTHER`) and `supplemental_specify`.
     - Stores in `requested_supplemental_purpose` and `requested_supplemental_specify`.
   - `PpmpWorkflowController::approveAmendmentRequest`:
     - Checks `$purpose = $ppmp->requested_supplemental_purpose ?: 'OTHER'`.
     - When `CONTINUATION`:
       - Sets `is_continuation = true`.
       - Sets `fiscal_year = date('Y')`.
       - Finds root Annual PPMP to store `baseline_annual_budget`.
       - Clones items with `start_date = null`, `end_date = null`, `delivery_period = null`, `estimated_budget = null`.
     - When `OTHER`:
       - Sets `is_continuation = false`.
       - Clones items copying all cells as-is from parent.
   - `PpmpWorkflowController::submitToHead` & `PpmpController::update`:
     - Enforces that continuation PPMP total budget does not exceed `baseline_annual_budget`.
     - Enforces that all items have non-null `start_date`, `end_date`, `delivery_period`, and `estimated_budget > 0` before submission.
3. **Frontend Component Updates**:
   - `PPMPDetailPage.jsx`:
     - Update "Request Supplemental / Amend PPMP" modal:
       - When "Supplemental" is checked: show radio options "For continuation" vs "Other:".
       - If "Other:" is checked: show text input to specify.
       - Send `supplemental_purpose` and `supplemental_specify` in FormData.
     - In Detail view: show continuation badge and annual budget limit indicator.
   - `PPMPFormPage.jsx`:
     - Display Annual PPMP Budget Ceiling warning if budget exceeds limit.
     - Validate that all schedule and budget cells are filled before allowing submission.
4. **Testing**:
   - Automated Feature Test `tests/Feature/SupplementalContinuationTest.php`.
