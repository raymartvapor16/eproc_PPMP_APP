<?php

use App\Http\Middleware\RoleMiddleware;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => RoleMiddleware::class,
        ]);

        $middleware->append(\App\Http\Middleware\ThreatDetectionMiddleware::class);

        $middleware->web(append: [
            \App\Http\Middleware\SecurityHeadersMiddleware::class,
            \App\Http\Middleware\VerifySessionFingerprint::class,
            \App\Http\Middleware\FormatBrowserAuthErrorResponse::class,
        ]);

    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, \Illuminate\Http\Request $request) {
            if (\App\Http\Middleware\FormatBrowserAuthErrorResponse::wantsHtmlErrorPage($request)) {
                return \App\Http\Middleware\FormatBrowserAuthErrorResponse::makeHtmlResponse($request, 401);
            }

            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
        });

        $exceptions->render(function (\Illuminate\Auth\Access\AuthorizationException $e, \Illuminate\Http\Request $request) {
            if (\App\Http\Middleware\FormatBrowserAuthErrorResponse::wantsHtmlErrorPage($request)) {
                return \App\Http\Middleware\FormatBrowserAuthErrorResponse::makeHtmlResponse($request, 403, $e->getMessage());
            }

            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(['message' => $e->getMessage() ?: 'Forbidden.'], 403);
            }
        });
    })->create();
