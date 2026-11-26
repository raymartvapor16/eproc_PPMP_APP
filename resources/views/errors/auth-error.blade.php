@php
    $statusCode = (int) ($status ?? 401);
    $isForbidden = $statusCode === 403;

    $codeLabel = $isForbidden ? 'HTTP 403 · FORBIDDEN' : 'HTTP 401 · UNAUTHENTICATED';
    $title = $isForbidden ? 'Access Denied' : 'Authentication Required';
    $subtitle = $isForbidden
        ? 'You are not authorized to view or access this protected resource.'
        : 'Please sign in with an authorized account to access this protected resource.';

    $detailMessage = !empty($message) && strtolower(trim((string) $message)) !== 'unauthenticated.'
        ? trim((string) $message)
        : ($isForbidden
            ? 'Your current role or office assignment does not have permission to open this document or endpoint. If you believe this is an error, please coordinate with the Office of the Provincial Procurement Management Officer (OPPMO).'
            : 'Your session may have expired, or this protected link was opened without an active login session. Sign in to continue.');

    $requestedPath = $path ?? ('/' . ltrim(request()->path(), '/'));
    $isAuthenticated = auth()->check();
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>{{ $statusCode }} — {{ $title }} | E-Procurement System</title>
    <link rel="icon" type="image/jpeg" href="/images/pmo.jpeg">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-dark: #070d1a;
            --bg-panel: rgba(15, 23, 42, 0.84);
            --border-subtle: rgba(148, 163, 184, 0.16);
            --text-primary: #f8fafc;
            --text-secondary: #cbd5e1;
            --text-muted: #94a3b8;
            --accent: {{ $isForbidden ? '#f43f5e' : '#3b82f6' }};
            --accent-soft: {{ $isForbidden ? 'rgba(244, 63, 94, 0.14)' : 'rgba(59, 130, 246, 0.16)' }};
            --accent-border: {{ $isForbidden ? 'rgba(244, 63, 94, 0.35)' : 'rgba(96, 165, 250, 0.35)' }};
            --accent-text: {{ $isForbidden ? '#fda4af' : '#93c5fd' }};
            --accent-btn: {{ $isForbidden ? 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }};
            --accent-btn-shadow: {{ $isForbidden ? 'rgba(225, 29, 72, 0.32)' : 'rgba(37, 99, 235, 0.35)' }};
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        html, body {
            min-height: 100%;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--bg-dark);
            color: var(--text-primary);
            -webkit-font-smoothing: antialiased;
        }

        body {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px 16px;
            overflow-x: hidden;
            background-image:
                radial-gradient(ellipse 75% 60% at 15% 15%, {{ $isForbidden ? 'rgba(244, 63, 94, 0.16)' : 'rgba(37, 99, 235, 0.20)' }}, transparent 60%),
                radial-gradient(ellipse 65% 55% at 85% 85%, rgba(14, 165, 233, 0.14), transparent 60%),
                linear-gradient(180deg, #070d1a 0%, #0b1326 55%, #070d1a 100%);
        }

        .bg-grid {
            position: fixed;
            inset: 0;
            pointer-events: none;
            background-image:
                linear-gradient(to right, rgba(148, 163, 184, 0.05) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(148, 163, 184, 0.05) 1px, transparent 1px);
            background-size: 40px 40px;
            mask-image: radial-gradient(circle at center, black 35%, transparent 80%);
            -webkit-mask-image: radial-gradient(circle at center, black 35%, transparent 80%);
        }

        .shell {
            position: relative;
            z-index: 1;
            width: 100%;
            max-width: 560px;
        }

        .brand-bar {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin-bottom: 20px;
            text-align: left;
        }

        .brand-logos {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .brand-logos img {
            width: 38px;
            height: 38px;
            border-radius: 9999px;
            object-fit: cover;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: #ffffff;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
        }

        .brand-text {
            line-height: 1.25;
        }

        .brand-title {
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #f8fafc;
        }

        .brand-sub {
            font-size: 11.5px;
            color: var(--text-muted);
        }

        .card {
            position: relative;
            background: var(--bg-panel);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--border-subtle);
            border-radius: 22px;
            padding: 36px 32px 30px;
            box-shadow:
                0 25px 60px -12px rgba(0, 0, 0, 0.65),
                inset 0 1px 0 rgba(255, 255, 255, 0.07);
            overflow: hidden;
        }

        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, transparent, var(--accent), transparent);
        }

        .status-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 24px;
        }

        .icon-wrap {
            width: 58px;
            height: 58px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--accent-soft);
            border: 1px solid var(--accent-border);
            color: var(--accent-text);
            flex-shrink: 0;
            box-shadow: 0 10px 25px -8px var(--accent-btn-shadow);
        }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            padding: 6px 12px;
            border-radius: 9999px;
            font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.06em;
            color: var(--accent-text);
            background: var(--accent-soft);
            border: 1px solid var(--accent-border);
        }

        .badge-dot {
            width: 7px;
            height: 7px;
            border-radius: 9999px;
            background: var(--accent);
            box-shadow: 0 0 10px var(--accent);
        }

        h1 {
            font-size: 26px;
            font-weight: 800;
            letter-spacing: -0.025em;
            color: #ffffff;
            margin-bottom: 8px;
        }

        .subtitle {
            font-size: 14.5px;
            line-height: 1.55;
            color: var(--text-secondary);
            margin-bottom: 20px;
        }

        .detail-box {
            background: rgba(2, 6, 23, 0.55);
            border: 1px solid rgba(148, 163, 184, 0.14);
            border-radius: 14px;
            padding: 15px 16px;
            margin-bottom: 24px;
        }

        .detail-label {
            font-size: 10.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-muted);
            margin-bottom: 6px;
        }

        .detail-text {
            font-size: 13.5px;
            line-height: 1.6;
            color: #e2e8f0;
            word-break: break-word;
        }

        .resource-pill {
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid rgba(148, 163, 184, 0.12);
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
            font-size: 11.5px;
            color: var(--text-muted);
            overflow: hidden;
        }

        .resource-pill span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 11px 18px;
            border-radius: 12px;
            font-size: 13.5px;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
            transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
            border: 1px solid transparent;
        }

        .btn-primary {
            flex: 1 1 200px;
            background: var(--accent-btn);
            color: #ffffff;
            box-shadow: 0 10px 22px -8px var(--accent-btn-shadow);
        }

        .btn-primary:hover {
            transform: translateY(-1px);
            filter: brightness(1.08);
        }

        .btn-secondary {
            flex: 1 1 140px;
            background: rgba(148, 163, 184, 0.1);
            border-color: rgba(148, 163, 184, 0.22);
            color: #e2e8f0;
        }

        .btn-secondary:hover {
            background: rgba(148, 163, 184, 0.18);
            border-color: rgba(148, 163, 184, 0.34);
        }

        .footer-meta {
            margin-top: 18px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 8px;
            font-size: 11.5px;
            color: var(--text-muted);
            padding: 0 4px;
        }

        .footer-meta a {
            color: #93c5fd;
            text-decoration: none;
            font-weight: 500;
        }

        .footer-meta a:hover {
            text-decoration: underline;
        }

        @media (max-width: 480px) {
            .card {
                padding: 26px 20px 22px;
                border-radius: 18px;
            }

            h1 {
                font-size: 22px;
            }

            .status-row {
                flex-direction: column;
                align-items: flex-start;
            }

            .actions {
                flex-direction: column;
            }

            .btn {
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="bg-grid" aria-hidden="true"></div>

    <main class="shell">
        <div class="brand-bar">
            <div class="brand-logos">
                <img src="/images/logo.png" alt="Province of Davao del Sur Seal">
                <img src="/images/pmo.jpeg" alt="OPPMO Logo">
            </div>
            <div class="brand-text">
                <div class="brand-title">E-Procurement System</div>
                <div class="brand-sub">Provincial Government of Davao del Sur · OPPMO</div>
            </div>
        </div>

        <section class="card" role="alert" aria-live="polite">
            <div class="status-row">
                <div class="icon-wrap" aria-hidden="true">
                    @if ($isForbidden)
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                        </svg>
                    @else
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            <circle cx="12" cy="16" r="1"/>
                        </svg>
                    @endif
                </div>

                <div class="badge">
                    <span class="badge-dot"></span>
                    <span>{{ $codeLabel }}</span>
                </div>
            </div>

            <h1>{{ $title }}</h1>
            <p class="subtitle">{{ $subtitle }}</p>

            <div class="detail-box">
                <div class="detail-label">Security Notice</div>
                <p class="detail-text">{{ $detailMessage }}</p>
                <div class="resource-pill" title="{{ $requestedPath }}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                    <span>{{ $requestedPath }}</span>
                </div>
            </div>

            <div class="actions">
                @if ($isForbidden && $isAuthenticated)
                    <a href="/" class="btn btn-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                        Return to Dashboard
                    </a>
                @else
                    <a href="/login" class="btn btn-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                            <polyline points="10 17 15 12 10 7"/>
                            <line x1="15" y1="12" x2="3" y2="12"/>
                        </svg>
                        Sign In to Continue
                    </a>
                @endif

                <a href="javascript:if(window.history.length>1){window.history.back();}else{window.location.href='/';}" class="btn btn-secondary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"/>
                        <polyline points="12 19 5 12 12 5"/>
                    </svg>
                    Go Back
                </a>
            </div>
        </section>

        <div class="footer-meta">
            <span>Protected by OPPMO Access Control · R.A. 10173</span>
            <a href="/">Portal Home</a>
        </div>
    </main>
</body>
</html>
