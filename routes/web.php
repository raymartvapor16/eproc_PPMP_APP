<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AccountCodeController;
use App\Http\Controllers\Api\ProgramNameController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PpmpAttachmentController;
use App\Http\Controllers\Api\PpmpCellCommentController;
use App\Http\Controllers\Api\PpmpController;
use App\Http\Controllers\Api\PpmpWorkflowController;
use App\Http\Controllers\Api\SignatoryController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\OfficeController;
use App\Http\Controllers\Api\FundSourceController;
use App\Http\Controllers\Api\ProcurementConditionController;
use App\Http\Controllers\Api\ProcurementModeController;
use App\Http\Controllers\Api\OtherTermController;
use App\Http\Controllers\Api\SupportingDocumentController;
use App\Http\Controllers\Api\SystemSettingController;
use App\Http\Controllers\Api\MonitoringController;
use App\Http\Controllers\Api\PortalSystemController;
use App\Http\Controllers\Api\OppmoTeamController;
use App\Http\Controllers\Api\DatabaseBackupController;
use App\Http\Controllers\Api\SupplierEvaluationController;
use App\Http\Controllers\Api\PurchaseRequestController;
use App\Http\Controllers\Api\PimsDashboardController;
use Illuminate\Support\Facades\Route;

Route::prefix('api')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:30,1');
    Route::post('/login/mfa/verify', [AuthController::class, 'verifySuperAdminMfa'])->middleware('throttle:15,1');
    Route::post('/login/mfa/resend', [AuthController::class, 'resendSuperAdminMfa'])->middleware('throttle:5,1');
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:30,1');
    Route::get('/public-offices', [OfficeController::class, 'index'])->middleware('throttle:240,1');
    Route::get('/public-account-codes', [AccountCodeController::class, 'publicDropdown'])->middleware('throttle:240,1');
    Route::get('/public-portal-systems', [PortalSystemController::class, 'publicIndex'])->middleware('throttle:240,1');
    Route::get('/portal-systems/pims-status', [PortalSystemController::class, 'pimsStatus'])->middleware('throttle:300,1');
    Route::get('/public-oppmo-team', [OppmoTeamController::class, 'publicIndex'])->middleware('throttle:240,1');
    Route::get('/oppmo-team-photo/{filename}', [OppmoTeamController::class, 'getPhoto'])->where('filename', '[A-Za-z0-9_\-\.]+')->middleware('throttle:300,1');
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/csrf-token', [AuthController::class, 'csrfToken'])->middleware('throttle:240,1');
    Route::get('/system-settings/developer-mode', [SystemSettingController::class, 'getDeveloperMode'])->middleware('throttle:240,1');
    Route::get('/system-settings/signatures', [SystemSettingController::class, 'getSignatureSettings'])->middleware('throttle:240,1');
    Route::get('/system-settings/afk-logout', [SystemSettingController::class, 'getAfkLogoutSettings'])->middleware('throttle:240,1');
    Route::get('/system-settings/turnstile', [SystemSettingController::class, 'getTurnstileSettings'])->middleware('throttle:240,1');

    Route::middleware(['auth', 'throttle:300,1'])->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/switch-role', [AuthController::class, 'switchRole']);
        Route::match(['put', 'post'], '/profile', [AuthController::class, 'updateProfile']);
        Route::post('/profile/renew-pnpki', [AuthController::class, 'renewPnpkiSignature']);
        Route::post('/profile/use-optional-signature', [AuthController::class, 'useOptionalSignature']);
        Route::post('/profile/photo', [AuthController::class, 'updateProfilePhoto']);
        Route::delete('/profile/photo', [AuthController::class, 'removeProfilePhoto']);
        Route::get('/profile/photo', [AuthController::class, 'getProfilePhoto'])->middleware('throttle:240,1');
        Route::get('/profile/signature', [AuthController::class, 'getSignature'])->middleware('throttle:120,1');
        Route::get('/users/{id}/refresh-token', [UserController::class, 'refreshToken'])->middleware('throttle:240,1');
        Route::get('/users/{id}/avatar', [UserController::class, 'getAvatar'])->middleware('throttle:240,1');
        Route::get('/users/{id}/signature', [UserController::class, 'getSignature'])->middleware('throttle:120,1');
        Route::get('/users/{id}/authorization-letter', [UserController::class, 'getAuthorizationLetter'])->middleware('throttle:120,1');
        Route::get('/users/{id}/pnpki-proof', [UserController::class, 'getPnpkiProof'])->middleware('throttle:120,1');
        Route::get('/pnpki-signatures', [UserController::class, 'pnpkiRegistry'])->middleware('throttle:120,1');
        Route::get('/dashboard', [DashboardController::class, 'index']);

        Route::get('/users', [UserController::class, 'index'])->middleware('role:admin,super_admin');
        Route::post('/users', [UserController::class, 'store'])->middleware('role:admin,super_admin');
        Route::post('/users/{id}/signature', [UserController::class, 'updateSignature'])->middleware('role:admin,super_admin');
        Route::post('/users/{id}/pnpki-renewal/approve', [UserController::class, 'approvePnpkiRenewal'])->middleware('role:super_admin');
        Route::post('/users/{id}/pnpki-renewal/reject', [UserController::class, 'rejectPnpkiRenewal'])->middleware('role:super_admin');
        Route::post('/users/{id}/change-password', [UserController::class, 'changePassword'])->middleware('role:admin,super_admin');
        Route::post('/users/{id}/approve', [UserController::class, 'approve'])->middleware('role:admin,super_admin');
        Route::post('/users/{id}/reject', [UserController::class, 'reject'])->middleware('role:admin,super_admin');
        Route::post('/users/{id}/toggle-status', [UserController::class, 'toggleStatus'])->middleware('role:admin,super_admin');
        Route::put('/users/{id}/role', [UserController::class, 'updateRole'])->middleware('role:admin,super_admin');
        Route::get('/users/{id}/account-codes', [UserController::class, 'getAccountCodes'])->middleware('role:admin,super_admin');
        Route::put('/users/{id}/account-codes', [UserController::class, 'updateAccountCodes'])->middleware('role:admin,super_admin');
        Route::put('/users/{id}/system-access', [UserController::class, 'updateSystemAccess'])->middleware('role:admin,super_admin');
        Route::delete('/users/{id}', [UserController::class, 'destroy'])->middleware('role:admin,super_admin');

        Route::get('/offices-list', [OfficeController::class, 'index']);
        Route::post('/offices', [OfficeController::class, 'store'])->middleware('role:super_admin');
        Route::put('/offices/{id}', [OfficeController::class, 'update'])->middleware('role:super_admin');
        Route::delete('/offices/{id}', [OfficeController::class, 'destroy'])->middleware('role:super_admin');
        Route::post('/offices/import', [OfficeController::class, 'import'])->middleware('role:super_admin');

        Route::get('/signatories', [SignatoryController::class, 'index']);
        Route::post('/signatories', [SignatoryController::class, 'store'])->middleware('role:admin,super_admin');
        Route::put('/signatories/{id}', [SignatoryController::class, 'update'])->middleware('role:admin,super_admin');
        Route::delete('/signatories/{id}', [SignatoryController::class, 'destroy'])->middleware('role:admin,super_admin');

        Route::put('/system-settings/developer-mode', [SystemSettingController::class, 'updateDeveloperMode'])->middleware('role:super_admin');
        Route::put('/system-settings/signatures', [SystemSettingController::class, 'updateSignatureSettings'])->middleware('role:super_admin');
        Route::put('/system-settings/afk-logout', [SystemSettingController::class, 'updateAfkLogoutSettings'])->middleware('role:super_admin');
        Route::put('/system-settings/turnstile', [SystemSettingController::class, 'updateTurnstileSettings'])->middleware('role:super_admin');

        Route::prefix('database-backup')->middleware('role:super_admin')->group(function () {
            Route::get('/status', [DatabaseBackupController::class, 'getStatus']);
            Route::post('/set-password', [DatabaseBackupController::class, 'setPassword']);
            Route::post('/request-token', [DatabaseBackupController::class, 'requestDownloadToken']);
            Route::match(['get', 'post'], '/download', [DatabaseBackupController::class, 'downloadBackup']);
            Route::post('/decrypt', [DatabaseBackupController::class, 'decryptBackup']);
        });

        Route::get('/portal-systems', [PortalSystemController::class, 'index'])->middleware('role:super_admin');
        Route::post('/portal-systems', [PortalSystemController::class, 'store'])->middleware('role:super_admin');
        Route::put('/portal-systems/{id}', [PortalSystemController::class, 'update'])->middleware('role:super_admin');
        Route::delete('/portal-systems/{id}', [PortalSystemController::class, 'destroy'])->middleware('role:super_admin');
        Route::patch('/portal-systems/{id}/toggle-status', [PortalSystemController::class, 'toggleStatus'])->middleware('role:super_admin');

        Route::get('/oppmo-team', [OppmoTeamController::class, 'index'])->middleware('role:super_admin');
        Route::post('/oppmo-team', [OppmoTeamController::class, 'store'])->middleware('role:super_admin');
        Route::post('/oppmo-team/{id}', [OppmoTeamController::class, 'update'])->middleware('role:super_admin');
        Route::put('/oppmo-team/{id}', [OppmoTeamController::class, 'update'])->middleware('role:super_admin');
        Route::delete('/oppmo-team/{id}', [OppmoTeamController::class, 'destroy'])->middleware('role:super_admin');
        Route::patch('/oppmo-team/{id}/toggle-status', [OppmoTeamController::class, 'toggleStatus'])->middleware('role:super_admin');

        Route::get('/fund-sources/export', [FundSourceController::class, 'export'])->middleware('role:admin,super_admin,budget_officer,pacco');
        Route::get('/fund-sources', [FundSourceController::class, 'index']);
        Route::post('/fund-sources', [FundSourceController::class, 'store'])->middleware('role:admin,super_admin,budget_officer,pacco');
        Route::put('/fund-sources/{id}', [FundSourceController::class, 'update'])->middleware('role:admin,super_admin,budget_officer,pacco');
        Route::delete('/fund-sources/{id}', [FundSourceController::class, 'destroy'])->middleware('role:admin,super_admin,budget_officer,pacco');

        Route::get('/procurement-conditions', [ProcurementConditionController::class, 'index']);
        Route::post('/procurement-conditions', [ProcurementConditionController::class, 'store'])->middleware('role:admin,super_admin');
        Route::put('/procurement-conditions/{id}', [ProcurementConditionController::class, 'update'])->middleware('role:admin,super_admin');
        Route::delete('/procurement-conditions/{id}', [ProcurementConditionController::class, 'destroy'])->middleware('role:admin,super_admin');

        Route::get('/procurement-modes', [ProcurementModeController::class, 'index']);
        Route::post('/procurement-modes', [ProcurementModeController::class, 'store'])->middleware('role:admin,super_admin');
        Route::put('/procurement-modes/{id}', [ProcurementModeController::class, 'update'])->middleware('role:admin,super_admin');
        Route::patch('/procurement-modes/{id}/toggle-status', [ProcurementModeController::class, 'toggleStatus'])->middleware('role:admin,super_admin');
        Route::delete('/procurement-modes/{id}', [ProcurementModeController::class, 'destroy'])->middleware('role:admin,super_admin');

        Route::get('/other-terms', [OtherTermController::class, 'index']);
        Route::post('/other-terms', [OtherTermController::class, 'store'])->middleware('role:admin,super_admin');
        Route::put('/other-terms/{id}', [OtherTermController::class, 'update'])->middleware('role:admin,super_admin');
        Route::delete('/other-terms/{id}', [OtherTermController::class, 'destroy'])->middleware('role:admin,super_admin');

        Route::get('/supporting-documents', [SupportingDocumentController::class, 'index']);
        Route::post('/supporting-documents', [SupportingDocumentController::class, 'store'])->middleware('role:admin,super_admin');
        Route::put('/supporting-documents/{id}', [SupportingDocumentController::class, 'update'])->middleware('role:admin,super_admin');
        Route::delete('/supporting-documents/{id}', [SupportingDocumentController::class, 'destroy'])->middleware('role:admin,super_admin');

        Route::get('/account-codes/stats', [AccountCodeController::class, 'stats'])->middleware('role:admin,super_admin');
        Route::get('/account-codes', [AccountCodeController::class, 'index']);
        Route::post('/account-codes', [AccountCodeController::class, 'store'])->middleware('role:admin,super_admin');
        Route::get('/account-codes/{id}', [AccountCodeController::class, 'show']);
        Route::put('/account-codes/{id}', [AccountCodeController::class, 'update'])->middleware('role:admin,super_admin');
        Route::patch('/account-codes/{id}/toggle-status', [AccountCodeController::class, 'toggleStatus'])->middleware('role:admin,super_admin');
        Route::delete('/account-codes/{id}', [AccountCodeController::class, 'destroy'])->middleware('role:admin,super_admin');

        Route::get('/program-names/stats', [ProgramNameController::class, 'stats'])->middleware('role:admin,super_admin');
        Route::get('/program-names', [ProgramNameController::class, 'index']);
        Route::post('/program-names', [ProgramNameController::class, 'store'])->middleware('role:admin,super_admin');
        Route::get('/program-names/{id}', [ProgramNameController::class, 'show']);
        Route::put('/program-names/{id}', [ProgramNameController::class, 'update'])->middleware('role:admin,super_admin');
        Route::patch('/program-names/{id}/toggle-status', [ProgramNameController::class, 'toggleStatus'])->middleware('role:admin,super_admin');
        Route::delete('/program-names/{id}', [ProgramNameController::class, 'destroy'])->middleware('role:admin,super_admin');

        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
        Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
        Route::delete('/notifications', [NotificationController::class, 'clearAll']);
        Route::get('/offices', [NotificationController::class, 'offices']);

        Route::get('/ppmps/next-tracker', [PpmpController::class, 'nextTrackingNumber']);
        Route::get('/ppmps/check-tracker', [PpmpController::class, 'checkTrackerAvailability']);
        Route::get('/ppmps', [PpmpController::class, 'index']);
        Route::post('/ppmps', [PpmpController::class, 'store']);
        Route::get('/ppmps/{uuid}', [PpmpController::class, 'show']);
        Route::put('/ppmps/{uuid}', [PpmpController::class, 'update']);
        Route::patch('/ppmps/{uuid}/tracking-number', [PpmpController::class, 'updateTrackingNumber']);
        Route::post('/ppmps/{uuid}/attachment-list', [PpmpController::class, 'saveAttachmentList']);
        Route::post('/ppmps/{uuid}/market-scoping', [PpmpController::class, 'saveMarketScoping']);
        Route::post('/ppmps/{uuid}/app-data', [PpmpController::class, 'saveAppData']);
        Route::get('/admin/ready-to-print', [PpmpController::class, 'readyToPrintList']);
        Route::post('/admin/ready-to-print/batch-details', [PpmpController::class, 'readyToPrintBatchDetails']);

        Route::get('/super-admin/security-threats', [\App\Http\Controllers\Api\SecurityThreatController::class, 'index']);
        Route::patch('/super-admin/security-threats/{id}/resolve', [\App\Http\Controllers\Api\SecurityThreatController::class, 'resolve']);
        Route::get('/super-admin/deleted-backups', [\App\Http\Controllers\Api\SecurityThreatController::class, 'deletedBackups']);
        Route::post('/super-admin/deleted-backups/{id}/restore', [\App\Http\Controllers\Api\SecurityThreatController::class, 'restoreDeletedBackup']);
        Route::get('/super-admin/scheduled-backups', [\App\Http\Controllers\Api\SecurityThreatController::class, 'scheduledBackups']);
        Route::post('/super-admin/scheduled-backups/run-now', [\App\Http\Controllers\Api\SecurityThreatController::class, 'runBackupNow']);
        Route::match(['get', 'post'], '/super-admin/scheduled-backups/{id}/download', [\App\Http\Controllers\Api\SecurityThreatController::class, 'downloadScheduledBackup']);

        Route::post('/ppmps/{uuid}/attachments', [PpmpAttachmentController::class, 'store']);
        Route::post('/ppmps/{uuid}/attachments/link', [PpmpAttachmentController::class, 'storeLink']);
        Route::patch('/ppmps/{uuid}/attachments/{attachmentUuid}/type', [PpmpAttachmentController::class, 'updateType']);
        Route::get('/ppmps/{uuid}/attachments/{attachmentUuid}/download', [PpmpAttachmentController::class, 'download']);
        Route::get('/ppmps/{uuid}/attachments/{attachmentUuid}/view', [PpmpAttachmentController::class, 'view']);
        Route::delete('/ppmps/{uuid}/attachments/{attachmentUuid}', [PpmpAttachmentController::class, 'destroy']);

        Route::get('/ppmps/{uuid}/cell-comments', [PpmpCellCommentController::class, 'index']);
        Route::post('/ppmps/{uuid}/cell-comments', [PpmpCellCommentController::class, 'store']);
        Route::delete('/ppmps/{uuid}/cell-comments/{commentId}', [PpmpCellCommentController::class, 'destroy']);
        Route::patch('/ppmps/{uuid}/cell-comments/{commentId}/comply', [PpmpCellCommentController::class, 'comply']);
        Route::patch('/ppmps/{uuid}/cell-comments/{commentId}/uncomply', [PpmpCellCommentController::class, 'uncomply']);
        Route::post('/ppmps/{uuid}/update-cell', [PpmpCellCommentController::class, 'updateCell']);

        Route::post('/ppmps/{uuid}/submit-to-head', [PpmpWorkflowController::class, 'submitToHead'])
            ->middleware('role:end_user');

        Route::post('/ppmps/{uuid}/head/approve', [PpmpWorkflowController::class, 'headApprove'])
            ->middleware('role:head');
        Route::post('/ppmps/{uuid}/head/return', [PpmpWorkflowController::class, 'headReturn'])
            ->middleware('role:head');

        Route::get('/ppmps/{uuid}/available-reviewers', [PpmpWorkflowController::class, 'getAvailableReviewers']);
        Route::put('/ppmps/{uuid}/reassign-reviewers', [PpmpWorkflowController::class, 'reassignReviewers']);
        Route::post('/ppmps/{uuid}/submit-for-review', [PpmpWorkflowController::class, 'submitForReview'])
            ->middleware('role:end_user');

        Route::post('/ppmps/{uuid}/budget/approve', [PpmpWorkflowController::class, 'budgetApprove'])
            ->middleware('role:budget_officer');
        Route::post('/ppmps/{uuid}/budget/return', [PpmpWorkflowController::class, 'budgetReturn'])
            ->middleware('role:budget_officer');
        Route::post('/ppmps/{uuid}/budget-head/approve', [PpmpWorkflowController::class, 'budgetHeadApprove'])
            ->middleware('role:head');

        Route::post('/ppmps/{uuid}/pacco/approve', [PpmpWorkflowController::class, 'paccoApprove'])
            ->middleware('role:pacco');
        Route::post('/ppmps/{uuid}/pacco/return', [PpmpWorkflowController::class, 'paccoReturn'])
            ->middleware('role:pacco');
        Route::post('/ppmps/{uuid}/pacco-head/approve', [PpmpWorkflowController::class, 'paccoHeadApprove'])
            ->middleware('role:head');

        Route::post('/ppmps/{uuid}/oppmo/approve', [PpmpWorkflowController::class, 'oppmoApprove'])
            ->middleware('role:oppmo');
        Route::post('/ppmps/{uuid}/oppmo/return', [PpmpWorkflowController::class, 'oppmoReturn'])
            ->middleware('role:oppmo');
        Route::post('/ppmps/{uuid}/oppmo-head/approve', [PpmpWorkflowController::class, 'oppmoHeadApprove'])
            ->middleware('role:head');
        Route::post('/ppmps/{uuid}/app-preparer/approve', [PpmpWorkflowController::class, 'appPreparerApprove']);
        Route::post('/ppmps/{uuid}/governor/approve', [PpmpWorkflowController::class, 'governorApprove']);

        Route::post('/ppmps/{uuid}/twg/approve', [PpmpWorkflowController::class, 'twgApprove'])
            ->middleware('role:twg');
        Route::post('/ppmps/{uuid}/twg/return', [PpmpWorkflowController::class, 'twgReturn'])
            ->middleware('role:twg');

        Route::post('/ppmps/{uuid}/return', [PpmpWorkflowController::class, 'returnReview']);

        Route::post('/ppmps/{uuid}/receive', [PpmpWorkflowController::class, 'receive']);

        Route::post('/ppmps/{uuid}/request-amendment-or-supplemental', [PpmpWorkflowController::class, 'requestAmendmentOrSupplemental'])->middleware('role:end_user');
        Route::post('/ppmps/{uuid}/amendment/approve', [PpmpWorkflowController::class, 'approveAmendmentRequest'])->middleware('role:admin,super_admin');
        Route::post('/ppmps/{uuid}/amendment/reject', [PpmpWorkflowController::class, 'rejectAmendmentRequest'])->middleware('role:admin,super_admin');

        Route::put('/ppmps/{uuid}/status', [PpmpWorkflowController::class, 'adminUpdateStatus'])->middleware('role:admin,super_admin');

        Route::get('/activity-logs', [ActivityLogController::class, 'index'])->middleware('role:admin,super_admin');

        Route::prefix('monitoring')->group(function () {
            Route::get('/stats', [MonitoringController::class, 'getStats']);
            Route::get('/pending-pims', [MonitoringController::class, 'pendingPims']);
            Route::get('/authorized-users', [MonitoringController::class, 'authorizedUsers']);
            Route::post('/authorized-users', [MonitoringController::class, 'updateAuthorizedUsers']);
            Route::get('/projects', [MonitoringController::class, 'index']);
            Route::post('/projects', [MonitoringController::class, 'store']);
            Route::get('/projects/{idOrUuid}', [MonitoringController::class, 'show']);
            Route::put('/projects/{idOrUuid}', [MonitoringController::class, 'update']);
            Route::patch('/projects/{idOrUuid}/pr-id', [MonitoringController::class, 'updatePrId']);
            Route::delete('/projects/{idOrUuid}', [MonitoringController::class, 'destroy']);

            Route::post('/projects/{idOrUuid}/steps', [MonitoringController::class, 'addStep']);
            Route::post('/projects/{idOrUuid}/reorder-steps', [MonitoringController::class, 'reorderSteps']);
            Route::put('/steps/{stepId}', [MonitoringController::class, 'updateStep']);
            Route::delete('/steps/{stepId}', [MonitoringController::class, 'deleteStep']);
        });

        Route::post('/monitoring/pims-publish', [MonitoringController::class, 'publishPims']);
        Route::post('/monitoring/pims-unpublish', [MonitoringController::class, 'unpublishPims']);

        Route::prefix('pims')->group(function () {
            Route::get('/dashboard', [PimsDashboardController::class, 'index']);
            Route::get('/purchase-requests', [PurchaseRequestController::class, 'index']);
            Route::get('/purchase-requests/ppmp-data/{ppmpUuid}', [PurchaseRequestController::class, 'getPpmpData']);
            Route::post('/purchase-requests', [PurchaseRequestController::class, 'store']);
            Route::get('/purchase-requests/{idOrUuid}', [PurchaseRequestController::class, 'show']);
            Route::put('/purchase-requests/{idOrUuid}', [PurchaseRequestController::class, 'update']);
            Route::post('/purchase-requests/{idOrUuid}/review', [PurchaseRequestController::class, 'review']);
            Route::get('/purchase-requests/{prUuid}/attachments/{attachmentUuid}/download', [PurchaseRequestController::class, 'downloadAttachment']);
        });

        Route::prefix('supplier-evaluation')->group(function () {
            Route::get('/dashboard-init', [SupplierEvaluationController::class, 'dashboardInit']);
            Route::get('/evaluations', [SupplierEvaluationController::class, 'evaluations']);
            Route::get('/evaluations/{id}', [SupplierEvaluationController::class, 'showEvaluation'])->whereNumber('id');
            Route::post('/evaluations', [SupplierEvaluationController::class, 'storeEvaluation']);
            Route::post('/evaluations/{id}/evaluate', [SupplierEvaluationController::class, 'evaluateOrUpdate'])->whereNumber('id');
            Route::delete('/evaluations/{id}', [SupplierEvaluationController::class, 'destroyEvaluation'])->whereNumber('id');
            Route::post('/evaluations/{id}/restore', [SupplierEvaluationController::class, 'restoreEvaluation'])->whereNumber('id');
            Route::delete('/evaluations/{id}/force', [SupplierEvaluationController::class, 'forceDeleteEvaluation'])->whereNumber('id');

            Route::get('/bulk/suppliers', [SupplierEvaluationController::class, 'getBulkSuppliers']);
            Route::get('/bulk/evaluations', [SupplierEvaluationController::class, 'fetchBulkEvaluations']);
            Route::post('/bulk/submit', [SupplierEvaluationController::class, 'submitBulkEvaluations']);

            Route::get('/recycle-bin', [SupplierEvaluationController::class, 'recycleBin']);

            Route::get('/purchase-orders', [SupplierEvaluationController::class, 'purchaseOrders']);
            Route::post('/purchase-orders', [SupplierEvaluationController::class, 'storePurchaseOrder']);
            Route::post('/purchase-orders/import', [SupplierEvaluationController::class, 'importPurchaseOrders']);
            Route::get('/purchase-orders/bulk-list', [SupplierEvaluationController::class, 'bulkPoList']);
            Route::post('/purchase-orders/bulk-evaluate', [SupplierEvaluationController::class, 'storeBulkPoEvaluations']);
            Route::post('/purchase-orders/{id}/update', [SupplierEvaluationController::class, 'updatePurchaseOrder'])->whereNumber('id');
            Route::put('/purchase-orders/{id}', [SupplierEvaluationController::class, 'updatePurchaseOrder'])->whereNumber('id');
            Route::delete('/purchase-orders/{id}', [SupplierEvaluationController::class, 'destroyPurchaseOrder'])->whereNumber('id');
            Route::post('/purchase-orders/{id}/upload-pdf', [SupplierEvaluationController::class, 'uploadPurchaseOrderPdf'])->whereNumber('id');
            Route::get('/purchase-orders/{id}/pdf', [SupplierEvaluationController::class, 'viewPurchaseOrderPdf'])->whereNumber('id');

            Route::get('/requests', [SupplierEvaluationController::class, 'listRequests']);
            Route::post('/requests', [SupplierEvaluationController::class, 'storeRequest']);
            Route::post('/requests/{id}/approve', [SupplierEvaluationController::class, 'approveRequest'])->whereNumber('id');
            Route::post('/requests/{id}/reject', [SupplierEvaluationController::class, 'rejectRequest'])->whereNumber('id');
            Route::delete('/requests/{id}', [SupplierEvaluationController::class, 'cancelRequest'])->whereNumber('id');

            Route::get('/pdfs', [SupplierEvaluationController::class, 'listAuthorizePdfs']);
            Route::post('/pdfs', [SupplierEvaluationController::class, 'uploadAuthorizePdf']);
            Route::post('/pdfs/{id}/status', [SupplierEvaluationController::class, 'updateAuthorizePdfStatus'])->whereNumber('id');
            Route::get('/pdfs/{id}/file', [SupplierEvaluationController::class, 'viewAuthorizePdfFile'])->whereNumber('id');

            Route::get('/analytics', [SupplierEvaluationController::class, 'analytics']);

            Route::get('/activity-logs', [SupplierEvaluationController::class, 'activityLogs']);
            Route::get('/activity-logs/export', [SupplierEvaluationController::class, 'exportActivityLogs']);
        });
    });
});

Route::get('/storage/oppmo_team/{filename}', [OppmoTeamController::class, 'getPhoto'])->where('filename', '[A-Za-z0-9_\-\.]+')->middleware('throttle:300,1');

Route::get('/login', function () {
    return view('app');
})->name('login');

Route::get('/{any}', function () {
    return view('app');
})->where('any', '.*');
