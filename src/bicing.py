import json
import math
import urllib.request
import urllib.error

LATITUDE = 41.4300
LONGITUDE = 2.1590
NUMBER_OF_STATIONS = 5
TIMEOUT = 30

PROVIDERS = [
    {
        "name": "B:SM",
        "information": "https://api.bsmsa.eu/ext/api/bsm/gbfs/v2/en/station_information",
        "status": "https://api.bsmsa.eu/ext/api/bsm/gbfs/v2/en/station_status",
    },
    {
        "name": "CityBikes",
        "information": "https://api.citybik.es/gbfs/2/bicing/station_information.json",
        "status": "https://api.citybik.es/gbfs/2/bicing/station_status.json",
    },
]


def get_json(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Horta08031/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"Error HTTP {error.code} consultant {url}") from None
    except urllib.error.URLError as error:
        raise RuntimeError(f"Error de connexió consultant {url}: {error.reason}") from None


def haversine_distance(lat1, lon1, lat2, lon2):
    radius = 6371.0
    lat1, lon1, lat2, lon2 = map(math.radians, (lat1, lon1, lat2, lon2))
    delta_lat, delta_lon = lat2 - lat1, lon2 - lon1
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_stations_from_provider(provider):
    information = get_json(provider["information"])
    status = get_json(provider["status"])
    information_stations = information.get("data", {}).get("stations", [])
    status_stations = status.get("data", {}).get("stations", [])
    if not information_stations or not status_stations:
        raise RuntimeError("La resposta de l'API no conté les estacions esperades")

    status_by_id = {str(s["station_id"]): s for s in status_stations if "station_id" in s}
    stations = []
    for station in information_stations:
        station_id = str(station.get("station_id", ""))
        current = status_by_id.get(station_id)
        if current is None:
            continue
        try:
            latitude, longitude = float(station["lat"]), float(station["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        stations.append({
            "id": station_id,
            "name": station.get("name", station.get("address", f"Estació {station_id}")),
            "distance": haversine_distance(LATITUDE, LONGITUDE, latitude, longitude),
            "latitude": latitude,
            "longitude": longitude,
            "bikes": current.get("num_bikes_available"),
            "docks": current.get("num_docks_available"),
            "installed": current.get("is_installed"),
            "renting": current.get("is_renting"),
            "returning": current.get("is_returning"),
        })
    if not stations:
        raise RuntimeError("No s'han trobat estacions amb dades d'estat disponibles")
    stations.sort(key=lambda station: station["distance"])
    return stations[:NUMBER_OF_STATIONS]


def get_bicing_stations():
    errors = []
    for provider in PROVIDERS:
        try:
            return get_stations_from_provider(provider), provider["name"]
        except Exception as error:
            errors.append(f"{provider['name']}: {error}")
    raise RuntimeError("No s'ha pogut obtenir informació de cap font de Bicing. " + " | ".join(errors))
