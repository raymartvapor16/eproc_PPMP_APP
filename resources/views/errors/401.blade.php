@include('errors.auth-error', [
    'status' => 401,
    'message' => isset($exception) ? $exception->getMessage() : null,
])
