from __future__ import annotations

PLACE_ORDER = ["chengdu", "hanzhong", "qishan", "jieting", "longyou", "wuzhangyuan", "changan"]

KNOWN_PLACE_IDS = set(PLACE_ORDER)

ROUTE_ENDPOINTS: dict[str, tuple[str, str]] = {
    "hanzhong_to_jieting": ("hanzhong", "jieting"),
    "jieting_to_longyou": ("jieting", "longyou"),
    "longyou_ops": ("longyou", "longyou"),
    "longyou_to_qishan": ("longyou", "qishan"),
    "qishan_to_wuzhangyuan": ("qishan", "wuzhangyuan"),
    "wuzhangyuan_ops": ("wuzhangyuan", "wuzhangyuan"),
    "wuzhangyuan_to_changan": ("wuzhangyuan", "changan"),
    "changan_ops": ("changan", "changan"),
}

KNOWN_ROUTE_IDS = set(ROUTE_ENDPOINTS)
