<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class AuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'action',
        'entity_type',
        'entity_id',
        'old_values',
        'new_values',
        'ip_address',
        'user_agent',
        'created_at',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'created_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Returns a human-readable description of the action.
     */
    public function humanDescription(): string
    {
        $actor = $this->user?->name ?? 'System';
        $entity = $this->entity_type === 'ppmps' ? 'PPMP #' . ($this->entity_id ?? '') : ($this->entity_type ?? 'record');

        $map = [
            // Auth
            'USER_LOGIN'               => "{$actor} logged in",
            'USER_LOGOUT'              => "{$actor} logged out",
            'USER_LOGIN_FAILED'        => "Failed login attempt",
            'LOGIN_THROTTLED'          => "Login throttled (too many attempts)",
            'USER_REGISTERED_PENDING'  => "{$actor} registered (pending approval)",
            'USER_PROFILE_UPDATED'     => "{$actor} updated their profile",

            // User Management
            'USER_APPROVED'            => "Admin approved user account",
            'USER_REJECTED'            => "Admin rejected user account",
            'USER_DEACTIVATED'         => "Admin deactivated user account",
            'USER_ACTIVATED'           => "Admin activated user account",
            'USER_PASSWORD_RESET'      => "Admin reset password for a user",

            // PPMP Lifecycle
            'PPMP_CREATED'             => "{$actor} created a new PPMP",
            'PPMP_UPDATED'             => "{$actor} updated {$entity}",
            'PPMP_CANCELLED'           => "{$actor} cancelled {$entity}",

            // Workflow
            'WORKFLOW_SUBMIT_TO_HEAD'    => "{$actor} submitted {$entity} to Office Head",
            'WORKFLOW_HEAD_APPROVED'     => "{$actor} (Head) approved {$entity}",
            'WORKFLOW_HEAD_RETURNED'     => "{$actor} (Head) returned {$entity} with remarks",
            'WORKFLOW_SUBMIT_FOR_REVIEW' => "{$actor} submitted {$entity} for formal review",
            'WORKFLOW_BUDGET_RECEIVED'   => "{$actor} (Budget Officer) received {$entity}",
            'WORKFLOW_BUDGET_APPROVED'   => "{$actor} (Budget Officer) approved {$entity}",
            'WORKFLOW_BUDGET_RETURNED'   => "{$actor} (Budget Officer) returned {$entity}",
            'WORKFLOW_OPPMO_RECEIVED'    => "{$actor} (OPPMO) received {$entity}",
            'WORKFLOW_OPPMO_APPROVED'    => "{$actor} (OPPMO) approved {$entity}",
            'WORKFLOW_OPPMO_RETURNED'    => "{$actor} (OPPMO) returned {$entity}",
            'WORKFLOW_TWG_RECEIVED'      => "{$actor} (TWG) received {$entity}",
            'WORKFLOW_TWG_APPROVED'      => "{$actor} (TWG) approved {$entity} — Routed to OPPMO for APP Generation",
            'WORKFLOW_OPPMO_APP_GENERATED' => "{$actor} (OPPMO) generated APP for {$entity} — Forwarded to Office Head",
            'WORKFLOW_TWG_RETURNED'      => "{$actor} (TWG) returned {$entity}",
            'WORKFLOW_DOCUMENT_RECEIVED' => "{$actor} received document for {$entity}",

            // Amendments
            'AMENDMENT_REQUESTED'        => "{$actor} requested amendment for {$entity}",
            'AMENDMENT_APPROVED'         => "Admin approved amendment request for {$entity}",
            'AMENDMENT_REJECTED'         => "Admin rejected amendment request for {$entity}",

            // Admin
            'SIGNATORY_CREATED'          => "Admin created a new official signatory",
            'SIGNATORY_UPDATED'          => "Admin updated an official signatory",
            'SIGNATORY_DELETED'          => "Admin deleted an official signatory",
            'OFFICE_CREATED'             => "Admin created a new office",
            'OFFICE_UPDATED'             => "Admin updated an office",
            'OFFICE_DELETED'             => "Admin deleted an office",
            'OFFICES_IMPORTED'           => "Admin imported offices from CSV/Excel",
            'FUND_SOURCE_CREATED'        => "Admin created a new source of fund",
            'FUND_SOURCE_UPDATED'        => "Admin updated a source of fund",
            'FUND_SOURCE_DELETED'        => "Admin deleted a source of fund",
            'CONDITION_CREATED'          => "Admin created a new procurement condition",
            'CONDITION_UPDATED'          => "Admin updated a procurement condition",
            'CONDITION_DELETED'          => "Admin deleted a procurement condition",
            'DEVELOPER_MODE_TOGGLED'     => "Super Admin modified Developer Mode setting",
        ];

        return $map[$this->action] ?? ucwords(str_replace('_', ' ', strtolower($this->action)));
    }

    /**
     * Returns a UI category string for color-coding.
     * Values: 'auth', 'workflow', 'admin', 'ppmp', 'user'
     */
    public function category(): string
    {
        $action = $this->action ?? '';

        if (str_starts_with($action, 'USER_LOGIN') || in_array($action, ['USER_LOGOUT', 'LOGIN_THROTTLED', 'USER_REGISTERED_PENDING'])) {
            return 'auth';
        }
        if (str_starts_with($action, 'WORKFLOW_')) {
            return 'workflow';
        }
        if (str_starts_with($action, 'AMENDMENT_')) {
            return 'amendment';
        }
        if (in_array($action, ['SIGNATORY_CREATED', 'SIGNATORY_UPDATED', 'SIGNATORY_DELETED', 'OFFICE_CREATED', 'OFFICE_UPDATED', 'OFFICE_DELETED', 'OFFICES_IMPORTED', 'FUND_SOURCE_CREATED', 'FUND_SOURCE_UPDATED', 'FUND_SOURCE_DELETED', 'CONDITION_CREATED', 'CONDITION_UPDATED', 'CONDITION_DELETED', 'DEVELOPER_MODE_TOGGLED'])) {
            return 'admin';
        }
        if (in_array($action, ['USER_APPROVED', 'USER_REJECTED', 'USER_DEACTIVATED', 'USER_ACTIVATED', 'USER_PASSWORD_RESET', 'USER_PROFILE_UPDATED'])) {
            return 'user';
        }
        if (str_starts_with($action, 'PPMP_')) {
            return 'ppmp';
        }

        return 'other';
    }

    public static function log(
        string $action,
        string $entityType,
        ?int $entityId = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?int $userId = null
    ): self {
        return self::create([
            'user_id'     => $userId ?? Auth::id(),
            'action'      => $action,
            'entity_type' => $entityType,
            'entity_id'   => $entityId,
            'old_values'  => $oldValues,
            'new_values'  => $newValues,
            'ip_address'  => request()->ip(),
            'user_agent'  => request()->userAgent(),
            'created_at'  => now(),
        ]);
    }
}
