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

    public static function encryptFileId(int $id): string
    {
        $payload = json_encode([
            'type' => 'auth_pdf',
            'pdfid' => $id,
            'n' => bin2hex(random_bytes(8)),
            'ts' => time(),
        ]);

        return rtrim(strtr(Crypt::encryptString($payload), '+/', '-_'), '=');
    }

    public static function decryptFileId(string $encrypted): ?int
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
                && ($data['type'] ?? null) === 'auth_pdf'
                && isset($data['pdfid'])
                && is_numeric($data['pdfid'])
                && (int) $data['pdfid'] > 0
            ) {
                return (int) $data['pdfid'];
            }
        } catch (\Throwable $e) {
            return null;
        }

        return null;
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
