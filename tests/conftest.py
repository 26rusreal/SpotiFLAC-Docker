"""Общие настройки тестового окружения."""
from __future__ import annotations

import sys
from pathlib import Path

КОРЕНЬ = Path(__file__).resolve().parent.parent
if str(КОРЕНЬ) not in sys.path:
    sys.path.insert(0, str(КОРЕНЬ))
