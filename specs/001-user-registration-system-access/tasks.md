# Tasks: User Registration System Role and Digital Systems Access Selection

**Input**: Design documents from `/specs/001-user-registration-system-access/`

**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm environment and feature workspace

- [x] [T001] [Setup] Verify Spec Kit feature directory and branch linkage in .specify/feature.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend and contract baseline

- [x] [T002] [P] [Foundational] Verify backend role validation rules in app/Http/Controllers/Api/AuthController.php
- [x] [T003] [P] [Foundational] Add automated test for empty system role validation rejection in tests/Feature/AuthorizedStaffTest.php

---

## Phase 3: User Story 1 - Manual Digital Systems Selection (Priority: P1) 🎯 MVP

**Goal**: Ensure digital system access checkboxes start completely unselected with "Please select system access..." placeholder

**Independent Test**:
- Open registration modal/page: system access trigger button displays "Please select system access..." and badge shows "0 systems selected".
- No checkboxes inside the dropdown menu are checked.
- Form submission without selected systems triggers client-side validation error.

### Implementation for User Story 1

- [x] [T004] [P] [US1] Initialize selectedSystems state to empty array [] in resources/js/pages/Auth/LoginPage.jsx
- [x] [T005] [US1] Remove automatic default selection effects for targetSystem in resources/js/pages/Auth/LoginPage.jsx
- [x] [T006] [US1] Update trigger button empty state to show placeholder "Please select system access..." and badge "0 systems selected" in resources/js/pages/Auth/LoginPage.jsx
- [x] [T007] [US1] Reset selectedSystems to [] on successful form submission in resources/js/pages/Auth/LoginPage.jsx

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Explicit System Role Selection (Priority: P1)

**Goal**: Force registering users to explicitly pick their System Role from a dropdown defaulting to "Please select system role..."

**Independent Test**:
- Open registration page: "System Role" dropdown defaults to disabled option "Please select system role..." with empty string value.
- Attempting to submit without selecting a role displays error "Please select your system role."
- Backend rejects requests missing or with invalid role with HTTP 422.

### Implementation for User Story 2

- [x] [T008] [P] [US2] Initialize registerData.role state to empty string in resources/js/pages/Auth/LoginPage.jsx
- [x] [T009] [US2] Add disabled placeholder option "Please select system role..." at the top of the role select element in resources/js/pages/Auth/LoginPage.jsx
- [x] [T010] [US2] Add client-side validation check in handleRegister requiring non-empty role in resources/js/pages/Auth/LoginPage.jsx
- [x] [T011] [US2] Reset registerData.role to empty string on successful registration in resources/js/pages/Auth/LoginPage.jsx

**Checkpoint**: User Story 2 is fully functional and independently testable.

---

## Phase 5: Polish & Verification

**Purpose**: Cross-cutting checks and regression suite execution

- [x] [T012] [Polish] Run frontend production build to verify no bundle or JSX syntax errors via npm run build
- [x] [T013] [Polish] Run PHPUnit test suite to verify backend auth & role validation via php artisan test --filter=AuthorizedStaffTest
