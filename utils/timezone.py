from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


try:
    LOCAL_TIMEZONE = ZoneInfo("America/Sao_Paulo")
except ZoneInfoNotFoundError:
    LOCAL_TIMEZONE = timezone(timedelta(hours=-3), name="America/Sao_Paulo")


def local_now():
    return datetime.now(LOCAL_TIMEZONE).replace(tzinfo=None)


def utc_naive_to_local_naive(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(LOCAL_TIMEZONE).replace(tzinfo=None)
