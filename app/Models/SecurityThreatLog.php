<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SecurityThreatLog extends Model
{
    protected $table = 'security_threat_logs';

    protected $fillable = [
        'threat_type',
        'severity',
        'is_red_alert',
        'user_id',
        'user_email',
        'ip_address',
        'forwarded_ips',
        'country',
        'region',
        'city',
        'isp',
        'latitude',
        'longitude',
        'http_method',
        'endpoint',
        'target_feature',
        'token_type',
        'token_preview',
        'user_agent',
        'attack_vector',
        'payload_summary',
        'status_code',
        'is_resolved',
        'resolved_by',
        'resolved_at',
    ];

    protected $casts = [
        'is_red_alert' => 'boolean',
        'is_resolved' => 'boolean',
        'payload_summary' => 'array',
        'resolved_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
