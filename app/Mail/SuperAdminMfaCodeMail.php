<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SuperAdminMfaCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $code;
    public string $accountEmail;
    public string $accountName;
    public string $ipAddress;
    public string $requestedAt;
    public int $expiresMinutes;

    public function __construct(
        string $code,
        string $accountEmail,
        string $accountName,
        string $ipAddress,
        int $expiresMinutes = 5
    ) {
        $this->code = $code;
        $this->accountEmail = $accountEmail;
        $this->accountName = $accountName;
        $this->ipAddress = $ipAddress;
        $this->requestedAt = now()->timezone('Asia/Manila')->format('F d, Y h:i:s A') . ' (PHT)';
        $this->expiresMinutes = $expiresMinutes;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '[E-Procurement Portal] Super Admin MFA Verification Code: ' . $this->code,
        );
    }

    public function content(): Content
    {
        $spacedCode = implode(' ', str_split($this->code));
        $safeName = e($this->accountName);
        $safeEmail = e($this->accountEmail);
        $safeIp = e($this->ipAddress);
        $safeTime = e($this->requestedAt);
        $mins = (int) $this->expiresMinutes;

        $html = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Super Admin MFA Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a,#1e3a8a);padding:22px 28px;color:#ffffff;">
              <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#fbbf24;">Provincial Government of Davao del Sur</div>
              <div style="font-size:18px;font-weight:800;margin-top:4px;">Super Admin Security Verification</div>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px;">
              <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155;">
                A Super Administrator sign-in attempt requires your one-time Multi-Factor Authentication (MFA) code before accessing the executive dashboard.
              </p>
              <div style="margin:20px 0;padding:18px 20px;background:#f8fafc;border:2px dashed #2563eb;border-radius:12px;text-align:center;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#64748b;margin-bottom:6px;">One-Time Verification Code</div>
                <div style="font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:900;letter-spacing:6px;color:#0f172a;">{$spacedCode}</div>
                <div style="font-size:12px;font-weight:600;color:#dc2626;margin-top:8px;">Expires in {$mins} minutes &bull; Single-use only</div>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;font-size:12px;color:#475569;">
                <tr><td style="padding:3px 0;"><strong>Account:</strong> {$safeName} ({$safeEmail})</td></tr>
                <tr><td style="padding:3px 0;"><strong>IP Address:</strong> {$safeIp}</td></tr>
                <tr><td style="padding:3px 0;"><strong>Requested At:</strong> {$safeTime}</td></tr>
              </table>
              <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#64748b;">
                <strong>Security Notice:</strong> Never share this code with anyone. If you did not initiate this Super Admin login, change your password immediately and review the Threat &amp; Intrusion Logs.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 28px;font-size:11px;color:#94a3b8;text-align:center;">
              OPPMO E-Procurement Multi-System Portal &bull; Automated Security Notification
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;

        return new Content(
            htmlString: $html,
        );
    }
}
