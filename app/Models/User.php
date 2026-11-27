<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    public function getConnectionName(): ?string
    {
        return $this->connection ?? config('database.default');
    }

    protected $fillable = [
        'name',
        'email',
        'phone_number',
        'address',
        'password',
        'role',
        'roles',
        'office_id',
        'designation',
        'signature_path',
        'profile_photo_path',
        'authorization_letter_path',
        'is_active',
        'approval_status',
        'rejection_reason',
        'accessible_systems',
        'can_view_all_monitoring_ppmp',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $appends = [
        'profile_photo_url',
        'available_roles',
        'encrypted_id',
    ];

    protected $with = [
        'pnpkiSignature',
    ];

    public static function encryptId(
        int $id,
        ?int $viewerId = null,
        ?string $sessionId = null,
        ?int $ttlSeconds = null
    ): string {
        $payload = [
            'uid' => $id,
            'n' => bin2hex(random_bytes(8)),
            'ts' => time(),
        ];

        if ($viewerId !== null) {
            $payload['vid'] = $viewerId;
        }
        if ($sessionId !== null && $sessionId !== '') {
            $payload['sid'] = hash('sha256', $sessionId);
        }
        if ($ttlSeconds !== null && $ttlSeconds > 0) {
            $payload['exp'] = time() + $ttlSeconds;
        }

        return rtrim(strtr(\Illuminate\Support\Facades\Crypt::encryptString(json_encode($payload)), '+/', '-_'), '=');
    }

    /**
     * @return array{id: ?int, error: ?string}
     */
    public static function decryptIdToken(
        string $encrypted,
        ?int $viewerId = null,
        ?string $sessionId = null,
        bool $checkExpiry = true
    ): array {
        $encrypted = trim($encrypted);
        if ($encrypted === '' || ctype_digit($encrypted)) {
            return ['id' => null, 'error' => 'Invalid or unencrypted user reference.'];
        }

        try {
            $b64 = strtr($encrypted, '-_', '+/');
            $b64 .= str_repeat('=', (4 - strlen($b64) % 4) % 4);
            $decrypted = \Illuminate\Support\Facades\Crypt::decryptString($b64);
            $data = json_decode($decrypted, true);

            if (is_array($data) && isset($data['uid']) && is_numeric($data['uid'])) {
                if (isset($data['vid']) && $viewerId !== null && (int) $data['vid'] !== $viewerId) {
                    return ['id' => null, 'error' => 'This secure document link is bound to another user and cannot be shared.'];
                }

                if (
                    isset($data['sid'])
                    && $sessionId !== null
                    && $sessionId !== ''
                    && !hash_equals((string) $data['sid'], hash('sha256', $sessionId))
                ) {
                    return ['id' => null, 'error' => 'This secure document link is bound to another session and cannot be shared.'];
                }

                if ($checkExpiry && isset($data['exp']) && time() > (int) $data['exp']) {
                    return ['id' => null, 'error' => 'This secure document link has expired. Please reopen it from the system.'];
                }

                return ['id' => (int) $data['uid'], 'error' => null];
            }

            if (ctype_digit($decrypted)) {
                return ['id' => (int) $decrypted, 'error' => null];
            }
        } catch (\Throwable $e) {
            return ['id' => null, 'error' => 'Invalid or unencrypted user reference.'];
        }

        return ['id' => null, 'error' => 'Invalid or unencrypted user reference.'];
    }

    public static function decryptId(
        string $encrypted,
        ?int $viewerId = null,
        ?string $sessionId = null,
        bool $checkExpiry = true
    ): ?int {
        return self::decryptIdToken($encrypted, $viewerId, $sessionId, $checkExpiry)['id'];
    }

    public function getEncryptedIdAttribute(): string
    {
        return self::encryptId((int) $this->id);
    }

    public function getProfilePhotoUrlAttribute(): ?string
    {
        if ($this->profile_photo_path && \Illuminate\Support\Facades\Storage::disk('local')->exists($this->profile_photo_path)) {
            return '/api/users/' . self::encryptId((int) $this->id) . '/avatar';
        }
        return null;
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'accessible_systems' => 'array',
            'can_view_all_monitoring_ppmp' => 'boolean',
            'roles' => 'array',
        ];
    }

    public function canViewAllMonitoringPpmps(): bool
    {
        return in_array($this->role, ['super_admin', 'admin'], true) || (bool) $this->can_view_all_monitoring_ppmp;
    }

    public function getAvailableRolesAttribute(): array
    {
        $raw = is_array($this->roles) ? $this->roles : [];
        $normalized = array_values(array_unique(array_filter(array_map(
            fn ($r) => is_string($r) ? trim($r) : '',
            $raw
        ))));

        if (empty($normalized) && !empty($this->role)) {
            return [$this->role];
        }

        if (!empty($this->role) && !in_array($this->role, $normalized, true)) {
            array_unshift($normalized, $this->role);
        }

        return $normalized;
    }

    public function hasMultipleRoles(): bool
    {
        return count($this->available_roles) > 1;
    }

    public function hasAssignedRole(string $role): bool
    {
        return in_array($role, $this->available_roles, true);
    }

    public function hasAnyAssignedRole(array $roles): bool
    {
        return count(array_intersect($roles, $this->available_roles)) > 0;
    }

    public function scopeWithRole($query, string $role)
    {
        return $query->where(function ($q) use ($role) {
            $q->where('role', $role)
                ->orWhereJsonContains('roles', $role);
        });
    }

    public function scopeWithAnyRole($query, array $roles)
    {
        return $query->where(function ($q) use ($roles) {
            $q->whereIn('role', $roles);
            foreach ($roles as $role) {
                $q->orWhereJsonContains('roles', $role);
            }
        });
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

    public function accountCodes()
    {
        return $this->belongsToMany(AccountCode::class, 'account_code_user')->withTimestamps();
    }

    public function pnpkiSignature()
    {
        return $this->hasOne(PnpkiSignature::class, 'user_id');
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
            return ['/eprocrementppmpapp', '/monitoringsystem', '/supplierevaluation', '/pims', '/pimssystem', '*'];
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
        $clean = '/' . ltrim(trim($systemPath), '/');
        $allowed = $this->getAccessibleSystemsList();
        if (in_array('*', $allowed, true)) {
            return true;
        }
        if (in_array($clean, $allowed, true)) {
            return true;
        }
        if (in_array($clean, ['/pims', '/pimssystem'], true)) {
            return in_array('/pims', $allowed, true) || in_array('/pimssystem', $allowed, true);
        }
        if (in_array($clean, ['/supplierevaluation', '/supplier-evaluation'], true)) {
            return in_array('/supplierevaluation', $allowed, true) || in_array('/supplier-evaluation', $allowed, true);
        }
        if (in_array($clean, ['/eprocrementppmpapp', '/eprocurementppmpapp'], true)) {
            return in_array('/eprocrementppmpapp', $allowed, true) || in_array('/eprocurementppmpapp', $allowed, true);
        }
        return false;
    }
}
