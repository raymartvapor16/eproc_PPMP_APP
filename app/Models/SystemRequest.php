<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

class SystemRequest extends Model
{
    use HasFactory;

    protected $table = 'system_requests';

    protected $fillable = [
        'ticket_number',
        'user_id',
        'office_id',
        'request_type',
        'system_module',
        'priority',
        'subject',
        'description',
        'attachment_path',
        'attachment_original_name',
        'attachment_mime',
        'attachment_size',
        'status',
        'admin_remarks',
        'handled_by',
        'resolved_at',
        'ip_address',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
        'attachment_size' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'office_id');
    }

    public function handler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }

    public static function encryptTicketToken(string $ticketNumber, int $userId, int $ttlSeconds = 1800): string
    {
        $payload = [
            'type' => 'sys_req_ticket',
            'ticket' => $ticketNumber,
            'uid' => $userId,
            'n' => bin2hex(random_bytes(8)),
            'exp' => time() + $ttlSeconds,
        ];

        return rtrim(strtr(Crypt::encryptString(json_encode($payload)), '+/', '-_'), '=');
    }

    /**
     * @return array{valid: bool, ticket: ?string, error: ?string}
     */
    public static function verifyTicketToken(string $token, string $expectedTicket, int $userId): array
    {
        $token = trim($token);
        if ($token === '') {
            return ['valid' => false, 'ticket' => null, 'error' => 'Missing ticket verification token. Please generate a new ticket.'];
        }

        try {
            $b64 = strtr($token, '-_', '+/');
            $b64 .= str_repeat('=', (4 - strlen($b64) % 4) % 4);
            $data = json_decode(Crypt::decryptString($b64), true);

            if (
                !is_array($data)
                || ($data['type'] ?? null) !== 'sys_req_ticket'
                || ($data['ticket'] ?? null) !== $expectedTicket
                || (int) ($data['uid'] ?? 0) !== $userId
            ) {
                return ['valid' => false, 'ticket' => null, 'error' => 'Invalid ticket token. Please generate a fresh ticket.'];
            }

            if (isset($data['exp']) && time() > (int) $data['exp']) {
                return ['valid' => false, 'ticket' => null, 'error' => 'Generated ticket has expired. Please generate a new ticket.'];
            }

            return ['valid' => true, 'ticket' => (string) $data['ticket'], 'error' => null];
        } catch (\Throwable $e) {
            return ['valid' => false, 'ticket' => null, 'error' => 'Invalid ticket token. Please generate a fresh ticket.'];
        }
    }

    public static function encryptAttachmentId(
        int $id,
        ?int $viewerId = null,
        ?string $sessionId = null,
        ?int $ttlSeconds = 120
    ): string {
        $payload = [
            'type' => 'sys_req_img',
            'srid' => $id,
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
    public static function decryptAttachmentToken(
        string $encrypted,
        ?int $viewerId = null,
        ?string $sessionId = null,
        bool $checkExpiry = true
    ): array {
        $encrypted = trim($encrypted);
        if ($encrypted === '' || ctype_digit($encrypted)) {
            return ['id' => null, 'error' => 'Invalid or unencrypted attachment reference.'];
        }

        try {
            $b64 = strtr($encrypted, '-_', '+/');
            $b64 .= str_repeat('=', (4 - strlen($b64) % 4) % 4);
            $data = json_decode(Crypt::decryptString($b64), true);

            if (
                !is_array($data)
                || ($data['type'] ?? null) !== 'sys_req_img'
                || !isset($data['srid'])
                || !is_numeric($data['srid'])
                || (int) $data['srid'] <= 0
            ) {
                return ['id' => null, 'error' => 'Invalid or unencrypted attachment reference.'];
            }

            if (isset($data['vid']) && $viewerId !== null && (int) $data['vid'] !== $viewerId) {
                return ['id' => null, 'error' => 'This secure attachment link is bound to another user and cannot be shared.'];
            }

            if (
                isset($data['sid'])
                && $sessionId !== null
                && $sessionId !== ''
                && !hash_equals((string) $data['sid'], hash('sha256', $sessionId))
            ) {
                return ['id' => null, 'error' => 'This secure attachment link is bound to another session and cannot be shared.'];
            }

            if ($checkExpiry && isset($data['exp']) && time() > (int) $data['exp']) {
                return ['id' => null, 'error' => 'This secure attachment link has expired. Please reopen it from the system.'];
            }

            return ['id' => (int) $data['srid'], 'error' => null];
        } catch (\Throwable $e) {
            return ['id' => null, 'error' => 'Invalid or unencrypted attachment reference.'];
        }
    }
}
