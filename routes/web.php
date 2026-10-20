<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PpmpAttachmentController;
use App\Http\Controllers\Api\PpmpController;
use App\Http\Controllers\Api\PpmpWorkflowController;
use App\Http\Controllers\Api\SignatoryController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\OfficeController;
use App\Http\Controllers\Api\FundSourceController;
use App\Http\Controllers\Api\ProcurementConditionController;
use App\Http\Controllers\Api\OtherTermController;
use App\Http\Controllers\Api\SupportingDocumentController;
use App\Http\Controllers\Api\SystemSettingController;
use App\Http\Controllers\Api\MonitoringController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web & API Routes for E-Procurement PPMP Review System
|--------------------------------------------------------------------------
*/

// Public Authentication Endpoints (Strictly rate-limited against brute force and DDoS)
Route::prefix('api')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:30,1');
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:30,1');
    Route::get('/public-offices', [OfficeController::class, 'index'])->middleware('throttle:240,1');
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/csrf-token', [AuthController::class, 'csrfToken'])->middleware('throttle:240,1');
    Route::get('/system-settings/developer-mode', [SystemSettingController::class, 'getDeveloperMode'])->middleware('throttle:240,1');
    Route::get('/system-settings/signatures', [SystemSettingController::class, 'getSignatureSettings'])->middleware('throttle:240,1');

    // Authenticated API routes (Protected by session authentication & API rate-limiting)
    Route::middleware(['auth', 'throttle:300,1'])->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        Route::get('/profile/signature', [AuthController::class, 'getSignature'])->middleware('throttle:120,1');
        Route::get('/users/{id}/signature', [UserController::class, 'getSignature'])->middleware('throttle:120,1');
        Route::get('/users/{id}/authorization-letter', [UserController::class, 'getAuthorizationLetter'])->middleware('throttle:120,1');
        Route::get('/dashboard', [DashboardController::class, 'index']);

        // Admin & Super Admin User Management
        Route::get('/users', [UserController::class, 'index'])->middleware('role:admin,super_admin');
        Route::post('/users', [UserController::class, 'store'])->middleware('role:admin,super_admin');
        Route::post('/users/{id}/signature', [UserController::class, 'updateSignature'])->middleware('role:admin,super_admin');
        Route::post('/users/{id}/change-password', [UserController::class, 'changePassword'])->middleware('role:admin,super_admin');
        Route::post('/users/{id}/approve', [UserController::class, 'approve'])->middleware('role:admin,super_admin');
        Route::post('/users/{id}/reject', [UserController::class, 'reject'])->middleware('role:admin,super_admin');
        Route::post('/users/{id}/toggle-status', [UserController::class, 'toggleStatus'])->middleware('role:admin,super_admin');
        Route::put('/users/{id}/role', [UserController::class, 'updateRole'])->middleware('role:admin,super_admin');
        Route::delete('/users/{id}', [UserController::class, 'destroy'])->middleware('role:admin,super_admin');

        // Super Admin Office Management & CSV/Excel Batch Import
        Route::get('/offices-list', [OfficeController::class, 'index']);
        Route::post('/offices', [OfficeController::class, 'store'])->middleware('role:super_admin');
        Route::put('/offices/{id}', [OfficeController::class, 'update'])->middleware('role:super_admin');
        Route::delete('/offices/{id}', [OfficeController::class, 'destroy'])->middleware('role:super_admin');
        Route::post('/offices/import', [OfficeController::class, 'import'])->middleware('role:super_admin');

        // Signatories (Public list, Admin & Super Admin management)
        Route::get('/signatories', [SignatoryController::class, 'index']);
        Route::post('/signatories', [SignatoryController::class, 'store'])->middleware('role:admin,super_admin');
        Route::put('/signatories/{id}', [SignatoryController::class, 'update'])->middleware('role:admin,super_admin');
        Route::delete('/signatories/{id}', [SignatoryController::class, 'destroy'])->middleware('role:admin,super_admin');

        // System Settings (Super Admin only)
        Route::put('/system-settings/developer-mode', [SystemSettingController::class, 'updateDeveloperMode'])->middleware('role:super_admin');
        Route::put('/system-settings/signatures', [SystemSettingController::class, 'updateSignatureSettings'])->middleware('role:super_admin');

        // Source of Fund Management (Public list for dropdowns, Admin & Super Admin CRUD)
        Route::get('/fund-sources', [FundSourceController::class, 'index']);
        Route::post('/fund-sources', [FundSourceController::class, 'store'])->middleware('role:admin,super_admin');
        Route::put('/fund-sources/{id}', [FundSourceController::class, 'update'])->middleware('role:admin,super_admin');
        Route::delete('/fund-sources/{id}', [FundSourceController::class, 'destroy'])->middleware('role:admin,super_admin');

        // Procurement Conditions Management (Public list for PPMP form dropdowns, Admin & Super Admin CRUD)
        Route::get('/procurement-conditions', [ProcurementConditionController::class, 'index']);
        Route::post('/procurement-conditions', [ProcurementConditionController::class, 'store'])->middleware('role:admin,super_admin');
        Route::put('/procurement-conditions/{id}', [ProcurementConditionController::class, 'update'])->middleware('role:admin,super_admin');
        Route::delete('/procurement-conditions/{id}', [ProcurementConditionController::class, 'destroy'])->middleware('role:admin,super_admin');

        // Other Terms & Green Specifications Management (Public list for PPMP form dropdowns, Admin & Super Admin CRUD)
        Route::get('/other-terms', [OtherTermController::class, 'index']);
        Route::post('/other-terms', [OtherTermController::class, 'store'])->middleware('role:admin,super_admin');
        Route::put('/other-terms/{id}', [OtherTermController::class, 'update'])->middleware('role:admin,super_admin');
        Route::delete('/other-terms/{id}', [OtherTermController::class, 'destroy'])->middleware('role:admin,super_admin');

        // Supporting Documents Management (Public list for PPMP form dropdowns, Admin & Super Admin CRUD)
        Route::get('/supporting-documents', [SupportingDocumentController::class, 'index']);
        Route::post('/supporting-documents', [SupportingDocumentController::class, 'store'])->middleware('role:admin,super_admin');
        Route::put('/supporting-documents/{id}', [SupportingDocumentController::class, 'update'])->middleware('role:admin,super_admin');
        Route::delete('/supporting-documents/{id}', [SupportingDocumentController::class, 'destroy'])->middleware('role:admin,super_admin');

        // Notifications & Utility
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
        Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
        Route::delete('/notifications', [NotificationController::class, 'clearAll']);
        Route::get('/offices', [NotificationController::class, 'offices']);

        // PPMP CRUD
        Route::get('/ppmps', [PpmpController::class, 'index']);
        Route::post('/ppmps', [PpmpController::class, 'store']);
        Route::get('/ppmps/{uuid}', [PpmpController::class, 'show']);
        Route::put('/ppmps/{uuid}', [PpmpController::class, 'update']);
        Route::post('/ppmps/{uuid}/attachment-list', [PpmpController::class, 'saveAttachmentList']);
        Route::post('/ppmps/{uuid}/app-data', [PpmpController::class, 'saveAppData']);

        // Secure Private PDF Attachments
        Route::post('/ppmps/{uuid}/attachments', [PpmpAttachmentController::class, 'store']);
        Route::patch('/ppmps/{uuid}/attachments/{attachmentUuid}/type', [PpmpAttachmentController::class, 'updateType']);
        Route::get('/ppmps/{uuid}/attachments/{attachmentUuid}/download', [PpmpAttachmentController::class, 'download']);
        Route::get('/ppmps/{uuid}/attachments/{attachmentUuid}/view', [PpmpAttachmentController::class, 'view']);
        Route::delete('/ppmps/{uuid}/attachments/{attachmentUuid}', [PpmpAttachmentController::class, 'destroy']);

        // Workflow Transitions
        // 1. Submit to Head
        Route::post('/ppmps/{uuid}/submit-to-head', [PpmpWorkflowController::class, 'submitToHead'])
            ->middleware('role:end_user');

        // 2. Head Approval / Return
        Route::post('/ppmps/{uuid}/head/approve', [PpmpWorkflowController::class, 'headApprove'])
            ->middleware('role:head');
        Route::post('/ppmps/{uuid}/head/return', [PpmpWorkflowController::class, 'headReturn'])
            ->middleware('role:head');

        // 3. Submit for formal review
        Route::post('/ppmps/{uuid}/submit-for-review', [PpmpWorkflowController::class, 'submitForReview'])
            ->middleware('role:end_user');

        // 4. Budget Officer Approval / Return
        Route::post('/ppmps/{uuid}/budget/approve', [PpmpWorkflowController::class, 'budgetApprove'])
            ->middleware('role:budget_officer');
        Route::post('/ppmps/{uuid}/budget/return', [PpmpWorkflowController::class, 'budgetReturn'])
            ->middleware('role:budget_officer');

        // 4b. PACCO Approval / Return (Trust Fund PPMPs)
        Route::post('/ppmps/{uuid}/pacco/approve', [PpmpWorkflowController::class, 'paccoApprove'])
            ->middleware('role:pacco');
        Route::post('/ppmps/{uuid}/pacco/return', [PpmpWorkflowController::class, 'paccoReturn'])
            ->middleware('role:pacco');

        // 5. OPPMO Approval / Return
        Route::post('/ppmps/{uuid}/oppmo/approve', [PpmpWorkflowController::class, 'oppmoApprove'])
            ->middleware('role:oppmo');
        Route::post('/ppmps/{uuid}/oppmo/return', [PpmpWorkflowController::class, 'oppmoReturn'])
            ->middleware('role:oppmo');

        // 6. TWG Approval / Return
        Route::post('/ppmps/{uuid}/twg/approve', [PpmpWorkflowController::class, 'twgApprove'])
            ->middleware('role:twg');
        Route::post('/ppmps/{uuid}/twg/return', [PpmpWorkflowController::class, 'twgReturn'])
            ->middleware('role:twg');

        // 7. Explicit Receive Document in current workflow stage
        Route::post('/ppmps/{uuid}/receive', [PpmpWorkflowController::class, 'receive']);

        // 8. Request Supplemental or Amendment (READY_TO_PRINT)
        Route::post('/ppmps/{uuid}/request-amendment-or-supplemental', [PpmpWorkflowController::class, 'requestAmendmentOrSupplemental'])->middleware('role:end_user');
        Route::post('/ppmps/{uuid}/amendment/approve', [PpmpWorkflowController::class, 'approveAmendmentRequest'])->middleware('role:admin,super_admin');
        Route::post('/ppmps/{uuid}/amendment/reject', [PpmpWorkflowController::class, 'rejectAmendmentRequest'])->middleware('role:admin,super_admin');

        // Activity Logs (Admin & Super Admin)
        Route::get('/activity-logs', [ActivityLogController::class, 'index'])->middleware('role:admin,super_admin');

        // OPPMO Monitoring System API Routes (Strictly accessible by monitor role only)
        Route::prefix('monitoring')->middleware('role:monitor')->group(function () {
            Route::get('/stats', [MonitoringController::class, 'getStats']);
            Route::get('/pending-pims', [MonitoringController::class, 'pendingPims']);
            Route::get('/projects', [MonitoringController::class, 'index']);
            Route::post('/projects', [MonitoringController::class, 'store']);
            Route::get('/projects/{idOrUuid}', [MonitoringController::class, 'show']);
            Route::put('/projects/{idOrUuid}', [MonitoringController::class, 'update']);
            Route::patch('/projects/{idOrUuid}/pr-id', [MonitoringController::class, 'updatePrId']);
            Route::delete('/projects/{idOrUuid}', [MonitoringController::class, 'destroy']);

            // Dynamic Step Management (In all division can add/delete steps)
            Route::post('/projects/{idOrUuid}/steps', [MonitoringController::class, 'addStep']);
            Route::put('/steps/{stepId}', [MonitoringController::class, 'updateStep']);
            Route::delete('/steps/{stepId}', [MonitoringController::class, 'deleteStep']);
        });

        // PIMS Publishing & Automatic Monitoring Link
        Route::post('/monitoring/pims-publish', [MonitoringController::class, 'publishPims'])->middleware('role:monitor,end_user');
    });
});

// Single Page Application entry for all frontend routes
Route::get('/{any}', function () {
    return view('app');
})->where('any', '.*');
