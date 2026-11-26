<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class FormatBrowserAuthErrorResponse
{
    public static function wantsHtmlErrorPage(Request $request): bool
    {
        if (!$request->isMethod('GET')) {
            return false;
        }

        if ($request->expectsJson() || $request->ajax()) {
            return false;
        }

        $accept = strtolower((string) $request->header('Accept', ''));

        return str_contains($accept, 'text/html');
    }

    public static function makeHtmlResponse(Request $request, int $status, ?string $message = null): Response
    {
        return response()
            ->view('errors.auth-error', [
                'status' => $status,
                'message' => is_string($message) && trim($message) !== '' ? trim($message) : null,
                'path' => '/' . ltrim($request->path(), '/'),
            ], $status)
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private')
            ->header('Pragma', 'no-cache');
    }

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $status = $response->getStatusCode();
        if (!in_array($status, [401, 403], true)) {
            return $response;
        }

        if (!self::wantsHtmlErrorPage($request)) {
            return $response;
        }

        $contentType = strtolower((string) $response->headers->get('Content-Type', ''));
        $isJsonResponse = $response instanceof JsonResponse || str_contains($contentType, 'application/json');
        if (!$isJsonResponse) {
            return $response;
        }

        $message = null;
        if ($response instanceof JsonResponse) {
            $data = $response->getData(true);
            if (is_array($data) && isset($data['message']) && is_string($data['message'])) {
                $message = $data['message'];
            }
        } else {
            $decoded = json_decode((string) $response->getContent(), true);
            if (is_array($decoded) && isset($decoded['message']) && is_string($decoded['message'])) {
                $message = $decoded['message'];
            }
        }

        return self::makeHtmlResponse($request, $status, $message);
    }
}
