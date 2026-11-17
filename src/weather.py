import json
import urllib.parse
import urllib.request

LATITUDE = 41.4300
LONGITUDE = 2.1590
TIMEZONE = "Europe/Madrid"
API_URL = "https://api.open-meteo.com/v1/forecast"


def get_weather_data():
    params = {
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m",
        "hourly": "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max",
        "forecast_days": 1,
        "timezone": TIMEZONE,
        "wind_speed_unit": "kmh",
    }
    url = API_URL + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent": "Horta08031/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8"))
    if "current" not in data or "daily" not in data or "hourly" not in data:
        raise RuntimeError("La resposta meteorològica és incompleta")
    return data
