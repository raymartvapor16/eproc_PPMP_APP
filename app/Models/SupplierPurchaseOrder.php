<?php

namespace App\Models;

use App\Models\Concerns\UsesSupplierEvalConnection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class SupplierPurchaseOrder extends Model
{
    use HasFactory, UsesSupplierEvalConnection;

    protected $table = 'supplier_purchase_orders';

    protected $fillable = [
        'po_no',
        'pr_no',
        'item',
        'pdf_po',
        'end_user',
        'supplier',
        'status',
    ];

    protected $appends = ['encrypted_id'];

    public static function encryptPdfId(
        int $id,
        ?int $viewerId = null,
        ?string $sessionId = null,
        ?int $ttlSeconds = 120
    ): string {
        $payload = [
            'type' => 'po_pdf',
            'poid' => $id,
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

        return rtrim(strtr(Crypt::encryptString(json_encode($payload)), '+/', '-_'), '=');
    }

    /**
     * @return array{id: ?int, error: ?string}
     */
    public static function decryptPdfToken(
        string $encrypted,
        ?int $viewerId = null,
        ?string $sessionId = null,
        bool $checkExpiry = true
    ): array {
        $encrypted = trim($encrypted);
        if ($encrypted === '' || ctype_digit($encrypted)) {
            return ['id' => null, 'error' => 'Invalid or unencrypted purchase order reference.'];
        }

        try {
            $b64 = strtr($encrypted, '-_', '+/');
            $b64 .= str_repeat('=', (4 - strlen($b64) % 4) % 4);
            $decrypted = Crypt::decryptString($b64);
            $data = json_decode($decrypted, true);

            if (
                !is_array($data)
                || ($data['type'] ?? null) !== 'po_pdf'
                || !isset($data['poid'])
                || !is_numeric($data['poid'])
                || (int) $data['poid'] <= 0
            ) {
                return ['id' => null, 'error' => 'Invalid or unencrypted purchase order reference.'];
            }

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

            return ['id' => (int) $data['poid'], 'error' => null];
        } catch (\Throwable $e) {
            return ['id' => null, 'error' => 'Invalid or unencrypted purchase order reference.'];
        }
    }

    public static function decryptPdfId(
        string $encrypted,
        ?int $viewerId = null,
        ?string $sessionId = null,
        bool $checkExpiry = true
    ): ?int {
        return self::decryptPdfToken($encrypted, $viewerId, $sessionId, $checkExpiry)['id'];
    }

    public function getEncryptedIdAttribute(): ?string
    {
        return $this->id ? self::encryptPdfId((int) $this->id) : null;
    }

    public function evaluation()
    {
        return $this->hasOne(SupplierEvaluation::class, 'po_no', 'po_no')
            ->latestOfMany();
    }
}

