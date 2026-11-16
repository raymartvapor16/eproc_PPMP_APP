# Implementation Plan: User Registration System Role and Digital Systems Access Selection

**Branch**: `001-user-registration-system-access` | **Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md)

## Summary

Update the registration workflow on the login/register page (`LoginPage.jsx`) and backend API (`AuthController.php`):
1. Make digital system access checkboxes unselected by default, updating the trigger button placeholder to "Please select system access...".
2. Change the System Role selection to start unselected with placeholder "Please select system role...", requiring explicit selection before submission.

## Tech Stack & Architecture

- **Frontend**: React 18, Tailwind CSS, Lucide React icons
  - Component: `resources/js/pages/Auth/LoginPage.jsx`
- **Backend**: Laravel 12 API
  - Controller: `app/Http/Controllers/Api/AuthController.php`
- **Testing**: PHPUnit / Pest Feature tests
  - Test file: `tests/Feature/AuthorizedStaffTest.php`

## Proposed Changes

### Frontend (`LoginPage.jsx`)
- Set `selectedSystems` initial state to `[]`.
- Remove auto-selection effects for `selectedSystems`.
- Update systems trigger button to display "Please select system access..." when empty.
- Set `registerData.role` initial state to `''`.
- Add disabled default option `<option value="" disabled>Please select system role...</option>`.
- Add client-side validation check for `registerData.role`.
- Reset form state on successful submission with empty `role` and empty `selectedSystems`.

### Backend (`AuthController.php`)
- Validate `'role'` with `'required|string|in:end_user,head,budget_officer,oppmo,twg,authorized_staff,pacco,pgso,presentative_staff'`.

### Testing
- Verify rejection with 422 when `role` is empty or omitted.
- Verify frontend builds cleanly with `npm run build`.
