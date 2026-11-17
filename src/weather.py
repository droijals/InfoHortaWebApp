
import json
import time
import socket
import ssl
import urllib.parse
import urllib.request
import urllib.error

LATITUDE = 41.4300
LONGITUDE = 2.1590
TIMEZONE = "Europe/Madrid"
API_URL = "https://api.open-meteo.com/v1/forecast"

TIMEOUT = 30
MAX_ATTEMPTS = 3
RETRY_DELAY = 2


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

    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Horta08031/1.0"}
    )

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
                data = json.loads(response.read().decode("utf-8"))

            if "current" not in data or "daily" not in data or "hourly" not in data:
                raise RuntimeError("La resposta meteorològica és incompleta")

            return data

        except urllib.error.HTTPError as error:
            # No repetir errores HTTP 4xx, excepto 429 (límite de peticiones).
            if error.code != 429 and error.code < 500:
                raise

            last_error = error

        except (
            urllib.error.URLError,
            TimeoutError,
            socket.timeout,
            ssl.SSLError
        ) as error:
            last_error = error

        if attempt < MAX_ATTEMPTS:
            delay = RETRY_DELAY * attempt
            print(
                f"Error consultant Open-Meteo "
                f"(intent {attempt}/{MAX_ATTEMPTS}): {last_error}. "
                f"Nou intent en {delay} segons..."
            )
            time.sleep(delay)

    raise RuntimeError(
        f"No s'han pogut obtenir les dades meteorològiques "
        f"després de {MAX_ATTEMPTS} intents: {last_error}"
    )
