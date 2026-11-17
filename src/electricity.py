import json
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

API_URL = "https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real"
TIMEZONE = ZoneInfo("Europe/Madrid")


def get_electricity_data():
    now = datetime.now(TIMEZONE)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    params = {
        "start_date": start.isoformat(), "end_date": end.isoformat(),
        "time_trunc": "hour", "geo_trunc": "electric_system",
        "geo_limit": "peninsular", "geo_ids": "8741",
    }
    url = API_URL + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={
        "Accept": "application/json", "User-Agent": "Horta08031/1.0",
    })
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))

    values = None
    for item in payload.get("included", []):
        attrs = item.get("attributes", {})
        if str(item.get("id")) == "1001" or "PVPC" in str(attrs.get("type", "")).upper():
            values = attrs.get("values", [])
            break
    if not values:
        raise RuntimeError("No s'han trobat dades PVPC a la resposta de REE")

    prices = []
    for item in values:
        if item.get("value") is None or not item.get("datetime"):
            continue
        stamp = datetime.fromisoformat(item["datetime"].replace("Z", "+00:00")).astimezone(TIMEZONE)
        prices.append({"time": stamp.isoformat(), "hour": stamp.strftime("%H:%M"),
                       "price_eur_kwh": float(item["value"]) / 1000})
    if not prices:
        raise RuntimeError("No s'han pogut interpretar els preus PVPC")

    numbers = [p["price_eur_kwh"] for p in prices]
    minimum, maximum = min(numbers), max(numbers)
    return {
        "date": start.date().isoformat(), "currency": "EUR", "unit": "kWh",
        "average_eur_kwh": sum(numbers) / len(numbers),
        "minimum_eur_kwh": minimum, "maximum_eur_kwh": maximum,
        "cheapest_hours": [p["hour"] for p in prices if p["price_eur_kwh"] == minimum],
        "most_expensive_hours": [p["hour"] for p in prices if p["price_eur_kwh"] == maximum],
        "hours": prices, "source": "Red Eléctrica (ESIOS)",
        "note": "Preu del terme d'energia PVPC a la zona peninsular; no inclou impostos ni components fixos.",
    }
