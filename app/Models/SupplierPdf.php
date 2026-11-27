<?php

namespace App\Models;

use App\Models\Concerns\UsesSupplierEvalConnection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class SupplierPdf extends Model
{
    use HasFactory, UsesSupplierEvalConnection;

    protected $table = 'supplier_pdfs';

    protected $fillable = [
        'user_id',
        'pdf_file',
        'status',
    ];

    public static function encryptFileId(
        int $id,
        ?int $viewerId = null,
        ?string $sessionId = null,
        ?int $ttlSeconds = 120
    ): string {
        $payload = [
            'type' => 'auth_pdf',
            'pdfid' => $id,
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
    public static function decryptFileToken(
        string $encrypted,
        ?int $viewerId = null,
        ?string $sessionId = null,
        bool $checkExpiry = true
    ): array {
        $encrypted = trim($encrypted);
        if ($encrypted === '' || ctype_digit($encrypted)) {
            return ['id' => null, 'error' => 'Invalid or unencrypted authorization PDF reference.'];
        }

        try {
            $b64 = strtr($encrypted, '-_', '+/');
            $b64 .= str_repeat('=', (4 - strlen($b64) % 4) % 4);
            $decrypted = Crypt::decryptString($b64);
            $data = json_decode($decrypted, true);

            if (
                !is_array($data)
                || ($data['type'] ?? null) !== 'auth_pdf'
                || !isset($data['pdfid'])
                || !is_numeric($data['pdfid'])
                || (int) $data['pdfid'] <= 0
            ) {
                return ['id' => null, 'error' => 'Invalid or unencrypted authorization PDF reference.'];
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

            return ['id' => (int) $data['pdfid'], 'error' => null];
        } catch (\Throwable $e) {
            return ['id' => null, 'error' => 'Invalid or unencrypted authorization PDF reference.'];
        }
    }

    public static function decryptFileId(
        string $encrypted,
        ?int $viewerId = null,
        ?string $sessionId = null,
        bool $checkExpiry = true
    ): ?int {
        return self::decryptFileToken($encrypted, $viewerId, $sessionId, $checkExpiry)['id'];
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function authorizes()
    {
        return $this->hasMany(SupplierAuthorize::class, 'pdf_id');
    }
}
