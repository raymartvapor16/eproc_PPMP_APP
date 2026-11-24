<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

class PnpkiSignature extends Model
{
    use HasFactory;

    public const EXPIRING_SOON_DAYS = 14;

    protected $table = 'pnpki_signatures';

    protected $fillable = [
        'user_id',
        'signature_type',
        'expiration_date',
        'previous_expiration_date',
        'proof_pdf_path',
        'proof_original_name',
        'previous_proof_pdf_path',
        'previous_proof_original_name',
        'signature_image_path',
        'capture_method',
        'renewal_history',
        'renewed_at',
        'renewal_count',
        'renewal_status',
        'pending_expiration_date',
        'pending_proof_pdf_path',
        'pending_proof_original_name',
        'pending_signature_image_path',
        'renewal_submitted_at',
        'renewal_reviewed_at',
        'renewal_reviewed_by',
        'renewal_rejection_reason',
    ];

    protected $appends = [
        'is_expired',
        'is_expiring_soon',
        'days_until_expiration',
        'effective_signature_type',
        'is_forced_optional',
        'is_renewal_pending',
        'has_proof_pdf',
        'proof_pdf_url',
        'previous_proof_pdf_url',
        'pending_proof_pdf_url',
    ];

    protected function casts(): array
    {
        return [
            'expiration_date' => 'date:Y-m-d',
            'previous_expiration_date' => 'date:Y-m-d',
            'pending_expiration_date' => 'date:Y-m-d',
            'renewal_history' => 'array',
            'renewed_at' => 'datetime',
            'renewal_submitted_at' => 'datetime',
            'renewal_reviewed_at' => 'datetime',
            'renewal_count' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function getDaysUntilExpirationAttribute(): ?int
    {
        if (!$this->expiration_date) {
            return null;
        }

        $today = Carbon::today();
        $expDate = Carbon::parse($this->expiration_date)->startOfDay();

        return (int) $today->diffInDays($expDate, false);
    }

    public function getIsExpiredAttribute(): bool
    {
        if (!$this->expiration_date) {
            return false;
        }

        return Carbon::parse($this->expiration_date)->endOfDay()->isPast();
    }

    public function getIsExpiringSoonAttribute(): bool
    {
        if (!\App\Models\SystemSetting::isPnpkiEnabled()) {
            return false;
        }

        if (!$this->expiration_date || $this->is_expired) {
            return false;
        }

        $days = $this->days_until_expiration;

        return $days !== null && $days >= 0 && $days <= self::EXPIRING_SOON_DAYS;
    }

    public function getEffectiveSignatureTypeAttribute(): string
    {
        if (!\App\Models\SystemSetting::isPnpkiEnabled()) {
            return 'optional';
        }

        if ($this->signature_type === 'pnpki' && !$this->is_expired) {
            return 'pnpki';
        }

        return 'optional';
    }

    public function getIsForcedOptionalAttribute(): bool
    {
        if (!\App\Models\SystemSetting::isPnpkiEnabled()) {
            return true;
        }

        return !empty($this->expiration_date) && $this->is_expired;
    }

    public function getHasProofPdfAttribute(): bool
    {
        return !empty($this->proof_pdf_path) && Storage::disk('local')->exists($this->proof_pdf_path);
    }

    public function getProofPdfUrlAttribute(): ?string
    {
        if (!empty($this->proof_pdf_path) && $this->user_id) {
            return "/api/users/{$this->user_id}/pnpki-proof";
        }

        return null;
    }

    public function getPreviousProofPdfUrlAttribute(): ?string
    {
        if (!empty($this->previous_proof_pdf_path) && $this->user_id) {
            return "/api/users/{$this->user_id}/pnpki-proof?version=previous";
        }

        return null;
    }

    public function getPendingProofPdfUrlAttribute(): ?string
    {
        if (!empty($this->pending_proof_pdf_path) && $this->user_id) {
            return "/api/users/{$this->user_id}/pnpki-proof?version=pending";
        }

        return null;
    }

    public function getIsRenewalPendingAttribute(): bool
    {
        return $this->renewal_status === 'pending' && !empty($this->pending_expiration_date);
    }
}
