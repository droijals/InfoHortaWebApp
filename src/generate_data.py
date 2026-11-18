import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

BASE_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DATA = BASE_DIR / "public" / "data" / "dashboard.json"
sys.path.insert(0, str(Path(__file__).resolve().parent))

from meteo_alerts import get_meteo_alerts
from bicing import get_bicing_stations
from electricity import get_electricity_data

TZ = ZoneInfo("Europe/Madrid")


def collect(name, function):
    try:
        result = function()
        if name == "bicing":
            stations, provider = result
            return {"status": "ok", "data": {"stations": stations, "provider": provider}, "error": None}
        return {"status": "ok", "data": result, "error": None}
    except Exception as exc:
        print(f"ERROR {name}: {exc}", file=sys.stderr)
        return {"status": "error", "data": None, "error": str(exc)}


def main():
    dashboard = {
        "location": {"name": "Horta, Barcelona", "postal_code": "08031",
                     "latitude": 41.4300, "longitude": 2.1590, "timezone": "Europe/Madrid"},
        "generated_at": datetime.now(TZ).isoformat(),
        "sections": {
            "alerts": collect("Meteocat", get_meteo_alerts),
            "bicing": collect("bicing", get_bicing_stations),
            "electricity": collect("electricitat", get_electricity_data),
        },
    }
    PUBLIC_DATA.parent.mkdir(parents=True, exist_ok=True)
    temporary = PUBLIC_DATA.with_suffix(".tmp")
    temporary.write_text(json.dumps(dashboard, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(PUBLIC_DATA)
    print(f"Dashboard actualitzat: {PUBLIC_DATA}")
    for name, result in dashboard["sections"].items():
        print(f"{name}: {result['status']}")
    if all(item["status"] == "error" for item in dashboard["sections"].values()):
        raise SystemExit("Totes les fonts de dades han fallat")


if __name__ == "__main__":
    main()
