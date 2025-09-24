"""Общие исключения для сервисного слоя."""


class JobCancelled(Exception):
    """Исключение для отменённых задач."""


class ProviderError(Exception):
    """Ошибка стороннего провайдера."""
