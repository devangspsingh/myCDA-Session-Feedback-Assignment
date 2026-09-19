"""
Request audit middleware.

Attaches the authenticated user to thread-local storage so that
model-layer code (e.g. BaseModelSerializer.create) can access the
current user without passing `request` through every layer.

Usage in serializers / models:
    from core.middleware import get_current_user
    user = get_current_user()
"""

import threading

_thread_locals = threading.local()


def get_current_user():
    """Return the user attached by RequestAuditMiddleware, or None."""
    user = getattr(_thread_locals, "user", None)
    if user and getattr(user, "is_authenticated", False):
        return user
    request = getattr(_thread_locals, "request", None)
    if request:
        req_user = getattr(request, "user", None)
        if req_user and getattr(req_user, "is_authenticated", False):
            return req_user
    return getattr(_thread_locals, "user", None)


class RequestAuditMiddleware:
    """
    Stores the authenticated user in thread-local storage for the
    duration of the request. Downstream code can call
    `get_current_user()` to retrieve it.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _thread_locals.request = request
        _thread_locals.user = getattr(request, "user", None)
        try:
            response = self.get_response(request)
        finally:
            # Clean up after the request to avoid leaking across threads
            _thread_locals.request = None
            _thread_locals.user = None
        return response
