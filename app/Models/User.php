<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'phone_number',
        'address',
        'password',
        'role',
        'office_id',
        'designation',
        'signature_path',
        'authorization_letter_path',
        'is_active',
        'approval_status',
        'rejection_reason',
        'accessible_systems',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'accessible_systems' => 'array',
        ];
    }

    public function office()
    {
        return $this->belongsTo(Office::class, 'office_id');
    }

    public function ppmps()
    {
        return $this->hasMany(Ppmp::class, 'created_by');
    }

    public function notifications()
    {
        return $this->hasMany(SystemNotification::class, 'user_id');
    }

    public function isEndUser(): bool
    {
        return $this->role === 'end_user';
    }

    public function isHead(): bool
    {
        return in_array($this->role, ['head', 'authorized_staff'], true);
    }

    public function isAuthorizedStaff(): bool
    {
        return $this->role === 'authorized_staff';
    }

    public function isBudgetOfficer(): bool
    {
        return $this->role === 'budget_officer';
    }

    public function isOppmo(): bool
    {
        return $this->role === 'oppmo';
    }

    public function isTwg(): bool
    {
        return $this->role === 'twg';
    }

    public function isPacco(): bool
    {
        return $this->role === 'pacco';
    }

    public function isReviewer(): bool
    {
        return in_array($this->role, ['budget_officer', 'oppmo', 'twg', 'pacco'], true);
    }

    public function isAdmin(): bool
    {
        return in_array($this->role, ['admin', 'super_admin'], true);
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    public function isAdminRole(): bool
    {
        return $this->role === 'admin';
    }

    public function isMonitor(): bool
    {
        return $this->role === 'monitor';
    }

    public function isPgso(): bool
    {
        return $this->role === 'pgso';
    }

    public function isPresentativeStaff(): bool
    {
        return in_array($this->role, ['presentative_staff', 'authorized_staff'], true);
    }

    public function canManageMonitoring(): bool
    {
        return in_array($this->role, ['super_admin', 'admin', 'monitor', 'oppmo'], true);
    }

    public function getAccessibleSystemsList(): array
    {
        if ($this->isAdmin()) {
            return ['/eprocrementppmpapp', '/monitoringsystem', '/supplierevaluation', '*'];
        }
        if (!empty($this->accessible_systems) && is_array($this->accessible_systems)) {
            return $this->accessible_systems;
        }
        if ($this->isMonitor()) {
            return ['/monitoringsystem'];
        }
        if ($this->isPgso()) {
            return ['/supplierevaluation'];
        }
        return ['/eprocrementppmpapp'];
    }

    public function canAccessSystem(string $systemPath): bool
    {
        if ($this->isAdmin()) {
            return true;
        }
        $allowed = $this->getAccessibleSystemsList();
        if (in_array('*', $allowed, true)) {
            return true;
        }
        $clean = '/' . ltrim(trim($systemPath), '/');
        return in_array($clean, $allowed, true);
    }
}
