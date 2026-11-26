@include('errors.auth-error', [
    'status' => 403,
    'message' => isset($exception) ? $exception->getMessage() : null,
])
