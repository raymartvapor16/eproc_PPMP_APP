<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PpmpAttachment extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'ppmp_id',
        'uploaded_by',
        'original_filename',
        'stored_filename',
        'storage_path',
        'external_url',
        'link_description',
        'mime_type',
        'attachment_type',
        'file_size',
    ];

    protected $appends = [
        'encrypted_uuid',
    ];

    protected static array $encryptedUuidCache = [];

    public static function encryptUuid(string $uuid): string
    {
        return static::$encryptedUuidCache[$uuid] ??= rtrim(strtr(\Illuminate\Support\Facades\Crypt::encryptString($uuid), '+/', '-_'), '=');
    }

    public static function decryptUuid(string $encrypted): string
    {

        if (preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/', $encrypted)) {
            return $encrypted;
        }

        try {
            $b64 = strtr($encrypted, '-_', '+/');
            $b64 .= str_repeat('=', (4 - strlen($b64) % 4) % 4);
            return \Illuminate\Support\Facades\Crypt::decryptString($b64);
        } catch (\Throwable $e) {
            return $encrypted;
        }
    }

    public function getEncryptedUuidAttribute(): string
    {
        return self::encryptUuid($this->uuid);
    }

    public function ppmp()
    {
        return $this->belongsTo(Ppmp::class, 'ppmp_id');
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
