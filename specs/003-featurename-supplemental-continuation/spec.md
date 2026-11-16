# Feature Specification: Supplemental PPMP with Continuation & Other Purpose

**Feature Branch**: `003-featurename-supplemental-continuation`  
**Created**: 2026-11-05  
**Status**: In Progress  

## User Request Summary
When requesting a Supplemental PPMP from an approved Annual PPMP:
1. Provide a selection with two options under Supplemental:
   - **For continuation** (`CONTINUATION`)
   - **Other:** (`OTHER`) with a mandatory input field to specify the reason / details.
2. When the Supplemental request is approved by an Administrator:
   - **If "For continuation" was chosen**:
     - Create a new child PPMP in `DRAFT` status with the **exact same tracker number**.
     - Set the `fiscal_year` (CY) to the **current year** (`date('Y')`).
     - Copy the metadata (office, title, implementing unit, program name, account code, source of fund).
     - On the procurement item rows:
       - `start_date` must be **null**.
       - `end_date` must be **null**.
       - `delivery_period` must be **null**.
       - `estimated_budget` must be manually entered (or 0) and the total estimated budget of the continuation PPMP **must not exceed** the total estimated budget of the original Annual PPMP.
     - **Submission Validation**: All required item cells (`start_date`, `end_date`, `delivery_period`, `estimated_budget > 0`, description, quantity, procurement mode, source of fund) must be completely filled out before the user can submit the continuation PPMP to the reviewer.
   - **If "Other: [specify]" was chosen**:
     - Create a new child PPMP in `DRAFT` status with the **same tracker number** and copy **all cells as-is** from the Annual PPMP (retaining dates and budgets).

## Functional Requirements
- **FR-1**: Modal UI in `PPMPDetailPage.jsx` displays "Supplemental" with a sub-selection: "For continuation" vs "Other:". When "Other:" is selected, a text input appears requiring the user to specify details.
- **FR-2**: Database schema migration adds `requested_supplemental_purpose`, `requested_supplemental_specify`, `supplemental_purpose`, `supplemental_purpose_specify` to `ppmp_amendments` and `is_continuation`, `baseline_annual_budget` to `ppmps`.
- **FR-3**: `PpmpWorkflowController::requestAmendmentOrSupplemental` validates and records `supplemental_purpose` and `supplemental_specify`.
- **FR-4**: `PpmpWorkflowController::approveAmendmentRequest`:
  - When purpose is `CONTINUATION`: sets `is_continuation = true`, `fiscal_year = date('Y')`, records `baseline_annual_budget` from the root Annual PPMP, sets line items `start_date`, `end_date`, `delivery_period`, `estimated_budget` to `null`.
  - When purpose is `OTHER`: copies all line item data as-is from the baseline PPMP.
- **FR-5**: Budget limit enforcement: The continuation PPMP's total budget cannot exceed the baseline Annual PPMP's total budget (enforced in frontend and backend API).
- **FR-6**: Pre-submission validation: Before submitting a continuation PPMP from DRAFT to Head / Reviewer, all item cells must be completely filled out (dates, delivery period, budget).
