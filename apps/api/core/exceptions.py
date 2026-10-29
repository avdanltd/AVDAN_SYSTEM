from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(message)

    def __reduce__(self) -> tuple[object, tuple[type["AppError"], int, str, str]]:
        # Celery pickles task exceptions to ship them to the result backend; the default
        # Exception pickling replays only `args` (the message) into __init__, which doesn't fit
        # this signature (nor the subclasses'), so every failure surfaced as an opaque
        # UnpickleableExceptionWrapper instead of the real error.
        return (_restore_app_error, (type(self), self.status_code, self.code, self.message))


def _restore_app_error(cls: type[AppError], status_code: int, code: str, message: str) -> AppError:
    exc = cls.__new__(cls)
    AppError.__init__(exc, status_code, code, message)
    return exc


class NotFoundException(AppError):  # noqa: N818
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(status.HTTP_404_NOT_FOUND, "NOT_FOUND", message)


class ValidationException(AppError):  # noqa: N818
    def __init__(self, message: str) -> None:
        super().__init__(status.HTTP_400_BAD_REQUEST, "VALIDATION_ERROR", message)


class AuthException(AppError):  # noqa: N818
    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", message)


class ForbiddenException(AppError):  # noqa: N818
    def __init__(self, message: str = "Forbidden") -> None:
        super().__init__(status.HTTP_403_FORBIDDEN, "FORBIDDEN", message)


class ConflictException(AppError):  # noqa: N818
    def __init__(self, message: str) -> None:
        super().__init__(status.HTTP_409_CONFLICT, "CONFLICT", message)


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    import logging

    from core.config import settings

    logging.getLogger(__name__).exception("Unhandled exception: %s", exc)

    message = str(exc) if not settings.is_production else "An unexpected error occurred"
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": {"code": "INTERNAL_ERROR", "message": message}},
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    first = errors[0] if errors else {}
    field = ".".join(str(loc) for loc in first.get("loc", [])[1:])
    message = f"{field}: {first.get('msg', 'Validation error')}" if field else first.get("msg", "Validation error")

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": {"code": "VALIDATION_ERROR", "message": message}},
    )
