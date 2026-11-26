@php
    $siteUrl = rtrim(config('app.url') ?: url('/'), '/');
    $currentPath = '/' . ltrim(request()->path(), '/');
    $isPublicIndexable = in_array($currentPath, ['/', '/privacy-policy'], true);
    $canonicalUrl = $currentPath === '/' ? $siteUrl . '/' : $siteUrl . $currentPath;
    $pageTitle = $currentPath === '/privacy-policy'
        ? 'Privacy Policy | PMO eProc — E-Procurement System (Davao del Sur)'
        : 'PMO eProc — E-Procurement System | Province of Davao del Sur (OPPMO)';
    $pageDescription = 'Official Electronic Procurement System (PMO eProc) of the Office of the Provincial Procurement Management Officer (OPPMO), Provincial Government of Davao del Sur. Access PPMP, APP, PIMS, Project Monitoring, and Supplier Evaluation services.';
    $structuredData = [
        '@context' => 'https://schema.org',
        '@graph' => [
            [
                '@type' => 'WebSite',
                'name' => 'PMO eProc — E-Procurement System',
                'alternateName' => ['pmoeproc', 'pmoeproc.cloud', 'PMO eProc', 'OPPMO Davao del Sur'],
                'url' => $siteUrl . '/',
                'description' => $pageDescription,
            ],
            [
                '@type' => 'GovernmentOrganization',
                'name' => 'Office of the Provincial Procurement Management Officer (OPPMO) — Province of Davao del Sur',
                'alternateName' => 'PMO eProc',
                'url' => $siteUrl . '/',
                'logo' => $siteUrl . '/favicon-192x192.png',
            ],
        ],
    ];
@endphp
<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-50">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $pageTitle }}</title>
    <meta name="description" content="{{ $pageDescription }}">
    <meta name="keywords" content="pmoeproc, pmoeproc.cloud, PMO eProc, E-Procurement System, OPPMO, Provincial Government of Davao del Sur, PPMP, APP, PIMS, Supplier Evaluation">
    <meta name="author" content="Office of the Provincial Procurement Management Officer — Province of Davao del Sur">
    <meta name="robots" content="{{ $isPublicIndexable ? 'index, follow' : 'noindex, nofollow' }}">
    <link rel="canonical" href="{{ $canonicalUrl }}">

    {{-- Open Graph / Social Sharing --}}
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="PMO eProc — E-Procurement System">
    <meta property="og:title" content="{{ $pageTitle }}">
    <meta property="og:description" content="{{ $pageDescription }}">
    <meta property="og:url" content="{{ $canonicalUrl }}">
    <meta property="og:image" content="{{ $siteUrl }}/images/pmo.jpeg">
    <meta property="og:locale" content="en_PH">

    {{-- Twitter / X Card --}}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{ $pageTitle }}">
    <meta name="twitter:description" content="{{ $pageDescription }}">
    <meta name="twitter:image" content="{{ $siteUrl }}/images/pmo.jpeg">

    {{-- Structured Data (JSON-LD) for Google Search --}}
    <script type="application/ld+json">{!! json_encode($structuredData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) !!}</script>

    <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon">
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
    <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">
    <link id="dynamic-favicon" rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

    <script>
        window.App = {
            user: @json(auth()->user() ? auth()->user()->load(\Illuminate\Support\Facades\Schema::hasTable('pnpki_signatures') ? ['office', 'pnpkiSignature'] : ['office']) : null),
            developer_mode: @json(\App\Models\SystemSetting::isDeveloperMode()),
            portal_systems: @json(\Illuminate\Support\Facades\Schema::hasTable('portal_systems') ? \App\Models\PortalSystem::orderBy('sort_order', 'asc')->orderBy('id', 'asc')->get() : []),
            turnstile_enabled: @json(\App\Models\SystemSetting::isTurnstileEnabled()),
            turnstile_site_key: @json((string) config('services.turnstile.site_key', '')),
            pnpki_enabled: @json(\App\Models\SystemSetting::isPnpkiEnabled()),
            signature_settings: @json(\App\Models\SystemSetting::getSignatureSettings())
        };
    </script>

    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])
</head>
<body class="h-full text-slate-800 antialiased font-sans selection:bg-blue-600 selection:text-white">
    <div id="root" class="h-full"></div>
</body>
</html>
