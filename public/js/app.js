
const $ = id => document.getElementById(id);

const number = (value, digits = 1) =>
  Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

const failed = section =>
  !section || section.status !== "ok" || section.data == null;

const unavailable = section =>
  '<p class="muted">' +
  esc(section?.error || "Dades encara no disponibles. Torna-ho a provar més tard.") +
  '</p>';

/* =====================================================
   METEOROLOGIA
   ===================================================== */

function renderWeather(data) {
  const c = data.current || {};
  const day = data.daily || {};

  const labels = {
    0: "Cel serè", 1: "Principalment serè",
    2: "Parcialment ennuvolat", 3: "Ennuvolat",
    45: "Boira", 48: "Boira gebradora",
    51: "Plugim feble", 53: "Plugim moderat", 55: "Plugim intens",
    61: "Pluja feble", 63: "Pluja moderada", 65: "Pluja intensa",
    80: "Ruixats febles", 81: "Ruixats moderats", 82: "Ruixats forts",
    95: "Tempesta", 96: "Tempesta amb calamarsa", 99: "Tempesta intensa"
  };

  return `
    <div class="weather-main">
      <div class="temperature">${number(c.temperature_2m)}°</div>
      <div class="weather-desc">
        ${esc(labels[Number(c.weather_code)] || "Condicions variables")}
        <br>
        <span class="muted">Sensació ${number(c.apparent_temperature)}°</span>
      </div>
    </div>

    <div class="metric-grid">
      <div class="metric">
        <strong>${number(day.temperature_2m_max?.[0])}°</strong>
        <small>MÀXIMA</small>
      </div>
      <div class="metric">
        <strong>${number(day.temperature_2m_min?.[0])}°</strong>
        <small>MÍNIMA</small>
      </div>
      <div class="metric">
        <strong>${number(c.relative_humidity_2m, 0)}%</strong>
        <small>HUMITAT</small>
      </div>
    </div>

    <p class="detail-line">
      Vent ${number(c.wind_speed_10m, 0)} km/h ·
      Probabilitat de pluja ${number(day.precipitation_probability_max?.[0], 0)}% ·
      Pluja prevista ${number(day.precipitation_sum?.[0])} mm
    </p>
  `;
}

async function loadWeather() {
  const content = $("weather");
  if (!content) return;

  content.innerHTML = '<p class="muted">Actualitzant meteorologia…</p>';

  try {
    const params = new URLSearchParams({
      latitude: "41.4300",
      longitude: "2.1590",
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m",
      hourly: "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max",
      forecast_days: "1",
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
      precipitation_unit: "mm",
      timezone: "Europe/Madrid"
    });

    const data = await fetchJsonNoCache("https://api.open-meteo.com/v1/forecast?" + params);

    if (!data.current || !data.daily || !data.hourly ||
        !Number.isFinite(Number(data.current.temperature_2m))) {
      throw new Error("La resposta d'Open-Meteo és incompleta.");
    }

    content.innerHTML = renderWeather(data);
  } catch (error) {
    content.innerHTML = `
      <p class="muted">No s'han pogut actualitzar les dades meteorològiques: ${esc(error.message)}</p>
    `;
  }
}

/* =====================================================
   AVISOS METEOROLÒGICS (TEMPSCAT / AEMET)
   ===================================================== */

function alertValue(alert, keys) {
  for (const key of keys) {
    const value = alert?.[key];
    if (value !== undefined && value !== null && value !== "") {
      if (typeof value === "object") {
        return value.name || value.value || value.text || "";
      }
      return String(value);
    }
  }
  return "";
}

function isCurrentAlert(alert, now = Date.now()) {
  const start = alertValue(alert, ["start", "starts_at", "onset", "effective", "start_time"]);
  const end = alertValue(alert, ["end", "ends_at", "expires", "expiry", "end_time"]);
  const startMs = start ? Date.parse(start) : NaN;
  const endMs = end ? Date.parse(end) : NaN;
  if (Number.isFinite(startMs) && startMs > now) return false;
  if (Number.isFinite(endMs) && endMs < now) return false;
  return true;
}

function formatAlertDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ca-ES", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Madrid"
  }).format(date);
}

function renderAlerts(warnings) {
  const current = Array.isArray(warnings)
    ? warnings.filter(alert => isCurrentAlert(alert))
    : [];

  if (!current.length) {
    return `
      <div class="alert-item">
        <strong>Sense avisos meteorològics vigents</strong>
        <span class="muted">No consten avisos actius per a Barcelona.</span>
      </div>
      <p class="source">Font: AEMET · Dades consultades a TempsCat.</p>
    `;
  }

  const items = current.map(alert => {
    const title = alertValue(alert, [
      "headline", "event", "title", "phenomenon", "meteor", "name", "phenomen"
    ]) || "Avís meteorològic";
    const level = alertValue(alert, ["level", "severity", "color", "danger", "nivel"]);
    const area = alertValue(alert, ["area", "areaDesc", "zone", "region", "comarca", "location"]);
    const start = alertValue(alert, ["start", "starts_at", "onset", "effective", "start_time"]);
    const end = alertValue(alert, ["end", "ends_at", "expires", "expiry", "end_time"]);
    const description = alertValue(alert, [
      "description", "text", "summary", "instruction", "desc"
    ]);

    const details = [
      level ? "Nivell " + level : "",
      area,
      start || end ? [formatAlertDate(start), formatAlertDate(end)].filter(Boolean).join(" — ") : ""
    ].filter(Boolean).join(" · ");

    return `
      <div class="alert-item">
        <strong>${esc(title)}</strong>
        ${details ? `<span class="muted">${esc(details)}</span>` : ""}
        ${description ? `<span class="muted">${esc(description)}</span>` : ""}
      </div>
    `;
  }).join("");

  return items + '<p class="source">Font: AEMET · Dades consultades a <a href="https://tempscat.cat/avisos" target="_blank" rel="noopener">TempsCat</a> (CC BY 4.0).</p>';
}

async function loadAlerts() {
  const content = $("alerts");
  if (!content) return;

  content.innerHTML = '<p class="muted">Consultant els avisos meteorològics…</p>';

  try {
    const data = await fetchJsonNoCache(
      "https://tempscat.cat/api/lloc/barcelones/barcelona"
    );

    if (!data || !Array.isArray(data.warnings)) {
      throw new Error("La resposta de TempsCat no conté una llista d'avisos vàlida.");
    }

    content.innerHTML = renderAlerts(data.warnings);
  } catch (error) {
    content.innerHTML = `
      <p class="muted">No s'han pogut actualitzar els avisos meteorològics: ${esc(error.message)}</p>
      <p class="source">Font consultada: <a href="https://tempscat.cat/avisos" target="_blank" rel="noopener">TempsCat · Avisos oficials</a>.</p>
    `;
  }
}

/* =====================================================
   BICING
   ===================================================== */

function renderBicing(section) {
  if (failed(section)) return unavailable(section);

  const stations = section.data?.stations;

  if (!Array.isArray(stations) || !stations.length) {
    return '<p class="muted">No hi ha estacions disponibles.</p>';
  }

  return stations.map(s => `
    <div class="station">
      <div>
        <div class="station-name">${esc(s.name)}</div>
        <span class="station-distance">
          ${number(s.distance, 2)} km ·
          ${s.installed === 0 ? "Fora de servei" : "Estat actual"}
        </span>
      </div>

      <div class="count">
        <strong>${esc(s.mechanicalBikes ?? "—")}</strong>
        <small>🚲 MECÀNIQUES</small>
      </div>

      <div class="count electric-count">
        <strong>${esc(s.electricBikes ?? "—")}</strong>
        <small>⚡ ELÈCTRIQUES</small>
      </div>

      <div class="count">
        <strong>${esc(s.docks ?? "—")}</strong>
        <small>BUITS</small>
      </div>
    </div>
  `).join("");
}

/* =====================================================
   PREU DE LA LLUM
   ===================================================== */

function renderElectricity(section) {
  if (failed(section)) return unavailable(section);

  const d = section.data;

  const fmt = value =>
    number(Number(value) * 100, 2) + " c€/kWh";

  const hours = (d.hours || []).map(p => {
    const cls =
      p.price_eur_kwh === d.minimum_eur_kwh ? "low" :
      p.price_eur_kwh === d.maximum_eur_kwh ? "high" : "";

    return `
      <div class="price-hour ${cls}">
        ${esc(p.hour)}
        <strong>${number(p.price_eur_kwh * 100, 2)}</strong>
      </div>
    `;
  }).join("");

  return `
    <div class="price-summary">
      <div class="metric">
        <strong>${fmt(d.average_eur_kwh)}</strong>
        <small>MITJANA</small>
      </div>

      <div class="metric">
        <strong style="color:var(--green)">
          ${fmt(d.minimum_eur_kwh)}
        </strong>
        <small>MÍNIM</small>
      </div>

      <div class="metric">
        <strong style="color:var(--red)">
          ${fmt(d.maximum_eur_kwh)}
        </strong>
        <small>MÀXIM</small>
      </div>
    </div>

    <div class="price-list">
      ${hours}
    </div>

    <p class="source">${esc(d.note || "")}</p>
  `;
}

/* =====================================================
   CONFIGURACIÓ DE LES SECCIONS
   ===================================================== */

const renderers = {
  electricity: renderElectricity
};

/* =====================================================
   OBTENCIÓ DEL JSON
   ===================================================== */

async function fetchDashboard() {
  const response = await fetch(
    "./data/dashboard.json?t=" + Date.now(),
    {
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }

  return await response.json();
}

/* =====================================================
   RECÀRREGA INDIVIDUAL D'UNA SECCIÓ
   ===================================================== */

const BICING_PROVIDERS = [
  {
    name: "B:SM",
    information: "https://api.bsmsa.eu/ext/api/bsm/gbfs/v2/en/station_information",
    status: "https://api.bsmsa.eu/ext/api/bsm/gbfs/v2/en/station_status"
  },
  {
    name: "CityBikes",
    information: "https://api.citybik.es/gbfs/2/bicing/station_information.json",
    status: "https://api.citybik.es/gbfs/2/bicing/station_status.json"
  }
];

const BICING_LATITUDE = 41.4300;
const BICING_LONGITUDE = 2.1590;
const BICING_STATION_COUNT = 5;

function distanceKm(lat1, lon1, lat2, lon2) {
  const radians = value => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchJsonNoCache(url) {
  const response = await fetch(url + (url.includes("?") ? "&" : "?") + "_=" + Date.now(), {
    cache: "no-store"
  });
  if (!response.ok) throw new Error("HTTP " + response.status + " consultant " + url);
  return response.json();
}

function getBikeTypeCounts(stationStatus) {
  const total = Number(
    stationStatus.num_bikes_available ?? stationStatus.num_vehicles_available
  );
  const types = stationStatus.vehicle_types_available;

  // Si la font no publica el desglossament, no deduïm el tipus de bicicleta.
  if (!Array.isArray(types) || !Number.isFinite(total)) {
    return { mechanical: null, electric: null };
  }

  const electric = types.reduce((sum, type) => {
    const typeId = String(type.vehicle_type_id || "").toLowerCase();
    const isElectric = /electric|ebike|e-bike|e_bike/.test(typeId);
    return sum + (isElectric ? Number(type.count || 0) : 0);
  }, 0);

  return {
    electric,
    mechanical: Math.max(0, total - electric)
  };
}

async function fetchBicingFromProvider(provider) {
  const [information, status] = await Promise.all([
    fetchJsonNoCache(provider.information),
    fetchJsonNoCache(provider.status)
  ]);

  const infoStations = information.data?.stations || [];
  const statusStations = status.data?.stations || [];
  if (!infoStations.length || !statusStations.length) {
    throw new Error("La resposta no conté les estacions esperades");
  }

  const statusById = new Map(
    statusStations.map(station => [String(station.station_id), station])
  );

  const stations = infoStations.flatMap(station => {
    const current = statusById.get(String(station.station_id));
    const lat = Number(station.lat);
    const lon = Number(station.lon);
    if (!current || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];

    return [{
      id: String(station.station_id),
      name: station.name || station.address || ("Estació " + station.station_id),
      distance: distanceKm(BICING_LATITUDE, BICING_LONGITUDE, lat, lon),
      latitude: lat,
      longitude: lon,
      bikes: current.num_bikes_available ?? current.num_vehicles_available,
      mechanicalBikes: getBikeTypeCounts(current).mechanical,
      electricBikes: getBikeTypeCounts(current).electric,
      docks: current.num_docks_available,
      installed: current.is_installed,
      renting: current.is_renting,
      returning: current.is_returning
    }];
  });

  if (!stations.length) throw new Error("No s'han trobat estacions amb estat disponible");

  stations.sort((a, b) => a.distance - b.distance);
  return {
    status: "ok",
    data: {
      stations: stations.slice(0, BICING_STATION_COUNT),
      provider: provider.name
    },
    error: null
  };
}

async function fetchFreshBicing() {
  const errors = [];
  for (const provider of BICING_PROVIDERS) {
    try {
      return await fetchBicingFromProvider(provider);
    } catch (error) {
      errors.push(provider.name + ": " + error.message);
    }
  }
  throw new Error("No s'ha pogut consultar cap font de Bicing. " + errors.join(" | "));
}

async function loadBicing(button) {
  const content = $("bicing");
  if (!content) return;

  if (button) {
    button.disabled = true;
    button.textContent = "Carregant…";
  }

  try {
    const section = await fetchFreshBicing();
    content.innerHTML = renderBicing(section);
  } catch (error) {
    content.innerHTML = `
      <p class="muted">Error actualitzant Bicing: ${esc(error.message)}</p>
    `;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Recarregar";
    }
  }
}

/* =====================================================
   CÀRREGA INICIAL DE TOTES LES SECCIONS
   ===================================================== */

async function loadDashboard() {
  const buttons = document.querySelectorAll(".panel-reload");

  buttons.forEach(button => {
    button.disabled = true;
  });

  try {
    const dashboard = await fetchDashboard();

    const sections = dashboard.sections || {};

    Object.keys(renderers).forEach(sectionName => {
      const content = $(sectionName);

      if (content) {
        content.innerHTML =
          renderers[sectionName](sections[sectionName]);
      }
    });

  } catch (error) {

    Object.keys(renderers).forEach(sectionName => {
      const content = $(sectionName);

      if (content) {
        content.innerHTML = `
          <p class="muted">
            Error carregant el dashboard: ${esc(error.message)}
          </p>
        `;
      }
    });

  } finally {
    buttons.forEach(button => {
      button.disabled = false;
    });
  }
}

/* =====================================================
   ASSOCIACIÓ DELS BOTONS RECARREGAR
   ===================================================== */

document.querySelectorAll('.panel-reload[data-section="bicing"]').forEach(button => {
  button.addEventListener("click", () => loadBicing(button));
});

/* =====================================================
   INICI DE L'APLICACIÓ
   ===================================================== */

loadDashboard();
loadBicing();
loadWeather();
loadAlerts();
