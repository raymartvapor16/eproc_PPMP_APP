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

    public static function encryptPdfId(int $id): string
    {
        $payload = json_encode([
            'type' => 'po_pdf',
            'poid' => $id,
            'n' => bin2hex(random_bytes(8)),
            'ts' => time(),
        ]);

        return rtrim(strtr(Crypt::encryptString($payload), '+/', '-_'), '=');
    }

    public static function decryptPdfId(string $encrypted): ?int
    {
        $encrypted = trim($encrypted);
        if ($encrypted === '' || ctype_digit($encrypted)) {
            return null;
        }

        try {
            $b64 = strtr($encrypted, '-_', '+/');
            $b64 .= str_repeat('=', (4 - strlen($b64) % 4) % 4);
            $decrypted = Crypt::decryptString($b64);
            $data = json_decode($decrypted, true);

            if (
                is_array($data)
                && ($data['type'] ?? null) === 'po_pdf'
                && isset($data['poid'])
                && is_numeric($data['poid'])
                && (int) $data['poid'] > 0
            ) {
                return (int) $data['poid'];
            }
        } catch (\Throwable $e) {
            return null;
        }

        return null;
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

