import json
import os
import urllib.request
import urllib.error
from datetime import datetime
from zoneinfo import ZoneInfo

API_URL = "https://api.meteo.cat/pronostic/v2/smp/episodis-oberts"
TIMEZONE = ZoneInfo("Europe/Madrid")
BARCELONES_ID = 13


def get_json(url):
    api_key = os.environ.get("METEOCAT_API_KEY")
    if not api_key:
        raise RuntimeError("Falta la variable METEOCAT_API_KEY")
    request = urllib.request.Request(url, headers={
        "X-Api-Key": api_key,
        "Content-Type": "application/json",
        "User-Agent": "Horta08031/1.0",
    })
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"Error HTTP {error.code} consultant el Meteocat") from None
    except urllib.error.URLError as error:
        raise RuntimeError(f"Error de connexió amb el Meteocat: {error.reason}") from None


def get_meteo_alerts():
    today = datetime.now(TIMEZONE).strftime("%Y-%m-%d")
    data = get_json(f"{API_URL}?data={today}Z")
    if not isinstance(data, list):
        raise RuntimeError("Format de resposta del Meteocat no vàlid")

    alerts = []
    for episode in data:
        meteor = episode.get("meteor", {}).get("nom", "Fenomen meteorològic")
        for alert in episode.get("avisos", []):
            start, end = alert.get("dataInici"), alert.get("dataFi")
            if not start or not end:
                continue
            periods = []
            for evolution in alert.get("evolucions", []):
                for period in evolution.get("periodes", []):
                    for affected in period.get("afectacions") or []:
                        if affected.get("idComarca") != BARCELONES_ID:
                            continue
                        periods.append({
                            "period": period.get("nom", ""),
                            "danger": affected.get("perill"),
                            "level": affected.get("nivell"),
                            "threshold": affected.get("llindar"),
                        })
            if periods:
                alerts.append({
                    "meteor": meteor,
                    "type": alert.get("tipus", "Avís"),
                    "start": start,
                    "end": end,
                    "danger": alert.get("nivell"),
                    "periods": periods,
                })
    return alerts
