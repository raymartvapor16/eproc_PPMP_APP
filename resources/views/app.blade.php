<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-50">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>E-PROCUREMENT SYSTEM</title>

    <link id="dynamic-favicon" rel="icon" type="image/jpeg" href="/images/pmo.jpeg">
    <link rel="apple-touch-icon" href="/images/pmo.jpeg">

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
