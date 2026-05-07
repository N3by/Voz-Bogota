import redis
from app.core.config import settings

redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)


def get_cache(key: str) -> str | None:
    return redis_client.get(key)


def set_cache(key: str, value: str, ttl: int = 60):
    redis_client.setex(key, ttl, value)


def delete_cache(key: str):
    redis_client.delete(key)


def delete_pattern(pattern: str):
    keys = redis_client.keys(pattern)
    if keys:
        redis_client.delete(*keys)
