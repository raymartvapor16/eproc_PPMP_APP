<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-50">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>E-PROCUREMENT SYSTEM</title>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

    <script>
        window.App = {
            user: @json(auth()->user() ? auth()->user()->load('office') : null),
            developer_mode: @json(\App\Models\SystemSetting::isDeveloperMode())
        };
    </script>

    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])
</head>
<body class="h-full text-slate-800 antialiased font-sans selection:bg-blue-600 selection:text-white">
    <div id="root" class="h-full"></div>
</body>
</html>
