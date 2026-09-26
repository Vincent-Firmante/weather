const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const DEFAULT_LOCATION = { name: 'London', admin1: '', country: 'United Kingdom', latitude: 51.5072, longitude: -0.1276 };
const STORAGE_KEYS = { unit: 'weatherline:unit', location: 'weatherline:location', favorites: 'weatherline:favorites', cache: 'weatherline:forecast:' };

const state = {
  unit: safeGet(STORAGE_KEYS.unit) === 'fahrenheit' ? 'fahrenheit' : 'celsius',
  location: parseStored(STORAGE_KEYS.location, DEFAULT_LOCATION),
  weather: null,
  air: null,
  timezone: 'UTC',
  searchTimer: null,
  searchController: null,
  requestId: 0,
  deferredInstall: null,
};

const elements = {
  searchForm: document.querySelector('#search-form'),
  searchInput: document.querySelector('#location-search'),
  searchResults: document.querySelector('#search-results'),
  locationName: document.querySelector('#location-name'),
  locationSubtitle: document.querySelector('#location-subtitle'),
  localDate: document.querySelector('#local-date'),
  status: document.querySelector('#status-line'),
  temperature: document.querySelector('#current-temperature'),
  condition: document.querySelector('#current-condition'),
  feelsLike: document.querySelector('#feels-like'),
  highLow: document.querySelector('#high-low'),
  currentArt: document.querySelector('#current-art'),
  currentTime: document.querySelector('#current-time'),
  hourly: document.querySelector('#hourly-list'),
  week: document.querySelector('#week-list'),
  humidity: document.querySelector('#humidity-value'),
  wind: document.querySelector('#wind-value'),
  uv: document.querySelector('#uv-value'),
  air: document.querySelector('#air-value'),
  rain: document.querySelector('#rain-value'),
  sun: document.querySelector('#sun-value'),
  airNote: document.querySelector('#air-note'),
  favoriteButton: document.querySelector('#favorite-button'),
  favoriteLabel: document.querySelector('#favorite-label'),
  favoritesRow: document.querySelector('#favorites-row'),
  refreshButton: document.querySelector('#refresh-button'),
  locateButton: document.querySelector('#locate-button'),
  installButton: document.querySelector('#install-button'),
  offlineIndicator: document.querySelector('#offline-indicator'),
};

const WEATHER_CODES = {
  0: ['Clear sky', 'sun'], 1: ['Mainly clear', 'sun-cloud'], 2: ['Partly cloudy', 'sun-cloud'], 3: ['Overcast', 'cloud'],
  45: ['Fog', 'fog'], 48: ['Depositing rime fog', 'fog'], 51: ['Light drizzle', 'rain-light'], 53: ['Drizzle', 'rain'], 55: ['Dense drizzle', 'rain'],
  56: ['Freezing drizzle', 'rain'], 57: ['Freezing drizzle', 'rain'], 61: ['Light rain', 'rain-light'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'rain'],
  66: ['Freezing rain', 'rain'], 67: ['Heavy freezing rain', 'rain'], 71: ['Light snow', 'snow'], 73: ['Snow', 'snow'], 75: ['Heavy snow', 'snow'],
  77: ['Snow grains', 'snow'], 80: ['Rain showers', 'rain'], 81: ['Rain showers', 'rain'], 82: ['Heavy showers', 'rain'],
  85: ['Snow showers', 'snow'], 86: ['Heavy snow showers', 'snow'], 95: ['Thunderstorm', 'thunder'], 96: ['Thunderstorm with hail', 'thunder'], 99: ['Thunderstorm with hail', 'thunder'],
};

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function parseStored(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Storage can be disabled or full. */ }
}

function weatherDescription(code) {
  return WEATHER_CODES[code] ?? ['Variable conditions', 'cloud'];
}

function weatherIcon(kind, isDay = true, small = false) {
  const sun = '<circle cx="39" cy="34" r="13" fill="#F4BD51"/><g stroke="#E6A83D" stroke-width="2.5" stroke-linecap="round"><path d="M39 12v5M39 51v5M17 34h5m34 0h5M23.5 18.5l3.6 3.6m23.8 23.8 3.6 3.6m0-31-3.6 3.6M27.1 45.9l-3.6 3.6"/></g>';
  const moon = '<path d="M48 17a18 18 0 0 0 19 24 20 20 0 1 1-19-24Z" fill="#F4BD51"/>';
  const cloud = '<path d="M22 56h35a12 12 0 0 0 0-24 18 18 0 0 0-34-3 14 14 0 0 0-1 27Z" fill="#fff" stroke="#BCD3CB" stroke-width="2" stroke-linejoin="round"/>';
  const rain = '<path d="m30 64-3 7m16-7-3 7m16-7-3 7" stroke="#5B94B5" stroke-width="3" stroke-linecap="round"/>';
  const snow = '<g stroke="#6B9BB1" stroke-width="2.2" stroke-linecap="round"><path d="M29 64v9m-4.5-4.5h9m-7.7-3.2 6.4 6.4m0-6.4-6.4 6.4M48 64v9m-4.5-4.5h9m-7.7-3.2 6.4 6.4m0-6.4-6.4 6.4"/></g>';
  const fog = '<path d="M18 64h43M23 71h36" stroke="#8AA79E" stroke-width="3" stroke-linecap="round"/>';
  const thunder = '<path d="m42 56-9 15h9l-3 11 14-18h-9l4-8Z" fill="#E9A94B" stroke="#D7983D" stroke-linejoin="round"/>';
  const dark = !isDay && (kind === 'sun' || kind === 'sun-cloud') ? moon : '';
  const content = kind === 'sun' ? (dark || sun) : kind === 'sun-cloud' ? `${isDay ? sun : moon}${cloud}` : kind === 'rain' || kind === 'rain-light' ? `${cloud}${rain}` : kind === 'snow' ? `${cloud}${snow}` : kind === 'fog' ? `${cloud}${fog}` : kind === 'thunder' ? `${cloud}${thunder}` : cloud;
  const viewBox = small ? '0 0 80 84' : '0 0 80 84';
  return `<svg viewBox="${viewBox}" fill="none" role="img" aria-hidden="true">${content}</svg>`;
}

function temperature(value) {
  if (!Number.isFinite(value)) return '--';
  const converted = state.unit === 'fahrenheit' ? value * 9 / 5 + 32 : value;
  return String(Math.round(converted));
}

function unitSymbol() { return state.unit === 'fahrenheit' ? '°F' : '°C'; }

function timeLabel(value, options = {}) {
  if (!value) return '--';
  const hasOffset = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  const date = new Date(hasOffset ? value : `${value}:00Z`);
  if (Number.isNaN(date.getTime())) return '--';
  try { return new Intl.DateTimeFormat(undefined, { timeZone: hasOffset ? state.timezone : 'UTC', ...options }).format(date); }
  catch { return new Intl.DateTimeFormat(undefined, options).format(date); }
}

function dayLabel(value, index) {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return timeLabel(`${value}T12:00`, { weekday: 'short' });
}

function windDirection(degrees) {
  if (!Number.isFinite(degrees)) return '';
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
}

function setStatus(message = '', kind = '') {
  elements.status.textContent = message;
  if (kind) elements.status.dataset.kind = kind;
  else delete elements.status.dataset.kind;
}

function updateLocationHeader() {
  elements.locationName.textContent = state.location.name || 'Your location';
  elements.locationSubtitle.textContent = [state.location.admin1, state.location.country].filter(Boolean).join(', ') || `${state.location.latitude.toFixed(2)}, ${state.location.longitude.toFixed(2)}`;
  const dateSource = state.weather?.current?.time || new Date().toISOString();
  elements.localDate.textContent = `LOCAL WEATHER  /  ${timeLabel(dateSource, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}`;
  const isFavorite = getFavorites().some((item) => sameLocation(item, state.location));
  elements.favoriteButton.setAttribute('aria-pressed', String(isFavorite));
  elements.favoriteLabel.textContent = isFavorite ? 'Saved' : 'Save place';
}

function setUnits() {
  document.querySelectorAll('[data-unit]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.unit === state.unit));
  });
  if (state.weather) renderWeather();
}

function getFavorites() {
  const favorites = parseStored(STORAGE_KEYS.favorites, []);
  return Array.isArray(favorites) ? favorites : [];
}

function sameLocation(first, second) {
  return Math.abs(first.latitude - second.latitude) < 0.01 && Math.abs(first.longitude - second.longitude) < 0.01;
}

function renderFavorites() {
  const favorites = getFavorites();
  elements.favoritesRow.replaceChildren();
  if (!favorites.length) {
    elements.favoritesRow.hidden = true;
    return;
  }
  elements.favoritesRow.hidden = false;
  favorites.forEach((place, index) => {
    const chip = document.createElement('button');
    chip.className = 'favorite-chip';
    chip.type = 'button';
    chip.setAttribute('aria-label', `Show weather for ${place.name}`);
    chip.append(document.createTextNode(place.name));
    const remove = document.createElement('span');
    remove.className = 'remove-favorite';
    remove.setAttribute('aria-label', `Remove ${place.name} from saved places`);
    remove.textContent = '×';
    chip.append(remove);
    chip.addEventListener('click', (event) => {
      if (event.target === remove) {
        event.stopPropagation();
        const next = getFavorites().filter((_, favoriteIndex) => favoriteIndex !== index);
        safeSet(STORAGE_KEYS.favorites, JSON.stringify(next));
        renderFavorites();
        updateLocationHeader();
        return;
      }
      selectLocation(place);
    });
    elements.favoritesRow.append(chip);
  });
}

function toggleFavorite() {
  const favorites = getFavorites();
  const existing = favorites.findIndex((item) => sameLocation(item, state.location));
  if (existing >= 0) favorites.splice(existing, 1);
  else favorites.unshift({ ...state.location });
  safeSet(STORAGE_KEYS.favorites, JSON.stringify(favorites.slice(0, 8)));
  renderFavorites();
  updateLocationHeader();
}

function cacheKey(location = state.location) {
  return `${STORAGE_KEYS.cache}${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}`;
}

function loadCachedForecast() {
  const cached = parseStored(cacheKey(), null);
  if (!cached?.weather) return false;
  state.weather = cached.weather;
  state.air = cached.air ?? null;
  state.timezone = cached.timezone || 'UTC';
  renderWeather();
  return true;
}

function setLoading(loading) {
  elements.refreshButton.classList.toggle('is-loading', loading);
  elements.refreshButton.setAttribute('aria-busy', String(loading));
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
  return response.json();
}

async function loadForecast({ quiet = false } = {}) {
  const requestId = ++state.requestId;
  const cached = loadCachedForecast();
  setLoading(true);
  if (!quiet) setStatus(cached ? 'Showing your last forecast while we check for updates…' : 'Loading the latest forecast…');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 14000);
  const base = { latitude: state.location.latitude, longitude: state.location.longitude, timezone: 'auto' };
  const weatherParams = new URLSearchParams({
    ...base,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max',
    forecast_days: '7',
  });
  const airParams = new URLSearchParams({ ...base, current: 'us_aqi,pm2_5' });

  try {
    const [weather, airResult] = await Promise.all([
      fetchJson(`${WEATHER_URL}?${weatherParams}`, controller.signal),
      fetchJson(`${AIR_URL}?${airParams}`, controller.signal).catch(() => null),
    ]);
    if (requestId !== state.requestId) return;
    if (!weather.current || !weather.daily || !weather.hourly) throw new Error('The forecast response was incomplete.');
    state.weather = weather;
    state.air = airResult?.current ?? null;
    state.timezone = weather.timezone || 'UTC';
    safeSet(cacheKey(), JSON.stringify({ weather: state.weather, air: state.air, timezone: state.timezone, savedAt: Date.now() }));
    renderWeather();
    setStatus(`Updated ${timeLabel(weather.current.time, { hour: 'numeric', minute: '2-digit' })} local time`, 'success');
  } catch (error) {
    if (requestId !== state.requestId) return;
    if (cached) {
      setStatus('Could not refresh. Showing the last saved forecast.', 'error');
    } else {
      setStatus(error.name === 'AbortError' ? 'The weather service took too long to respond. Try again.' : 'Could not load weather. Check your connection and try again.', 'error');
      elements.condition.textContent = 'Forecast unavailable';
    }
  } finally {
    clearTimeout(timeoutId);
    if (requestId === state.requestId) setLoading(false);
  }
}

function renderWeather() {
  const weather = state.weather;
  if (!weather) return;
  const current = weather.current;
  const daily = weather.daily;
  const [description, icon] = weatherDescription(current.weather_code);
  elements.temperature.textContent = temperature(current.temperature_2m);
  elements.condition.textContent = description;
  elements.feelsLike.textContent = `Feels like ${temperature(current.apparent_temperature)}${unitSymbol()}`;
  elements.highLow.innerHTML = `<span>H ${temperature(daily.temperature_2m_max[0])}°</span><span>L ${temperature(daily.temperature_2m_min[0])}°</span>`;
  elements.currentArt.innerHTML = weatherIcon(icon, Boolean(current.is_day));
  elements.currentTime.textContent = `Local time ${timeLabel(current.time, { hour: 'numeric', minute: '2-digit' })}`;
  elements.humidity.textContent = `${current.relative_humidity_2m}%`;
  const wind = Math.round(current.wind_speed_10m);
  const speed = state.unit === 'fahrenheit' ? `${Math.round(wind * 0.621371)} mph` : `${wind} km/h`;
  elements.wind.textContent = `${speed} ${windDirection(current.wind_direction_10m)}`.trim();
  const uv = daily.uv_index_max[0];
  elements.uv.textContent = `${Number(uv).toFixed(uv < 3 ? 1 : 0)} · ${uvLabel(uv)}`;
  const aqi = state.air?.us_aqi;
  elements.air.textContent = Number.isFinite(aqi) ? `${Math.round(aqi)} · ${aqiLabel(aqi)}` : 'Unavailable';
  elements.airNote.textContent = Number.isFinite(state.air?.pm2_5) ? `PM2.5 ${Number(state.air.pm2_5).toFixed(1)} μg/m³ · US AQI scale` : 'Air quality is reported on the US AQI scale.';
  elements.rain.textContent = `${daily.precipitation_probability_max[0] ?? '--'}% today`;
  elements.sun.textContent = `${timeLabel(daily.sunrise[0], { hour: 'numeric', minute: '2-digit' })} / ${timeLabel(daily.sunset[0], { hour: 'numeric', minute: '2-digit' })}`;
  renderHourly(weather);
  renderWeek(weather);
  updateLocationHeader();
}

function uvLabel(value) {
  if (value < 3) return 'Low';
  if (value < 6) return 'Moderate';
  if (value < 8) return 'High';
  if (value < 11) return 'Very high';
  return 'Extreme';
}

function aqiLabel(value) {
  if (value <= 50) return 'Good';
  if (value <= 100) return 'Moderate';
  if (value <= 150) return 'Sensitive';
  if (value <= 200) return 'Unhealthy';
  if (value <= 300) return 'Very unhealthy';
  return 'Hazardous';
}

function renderHourly(weather) {
  const hourly = weather.hourly;
  const currentTime = weather.current.time;
  let startIndex = hourly.time.findIndex((time) => time >= currentTime);
  if (startIndex < 0) startIndex = 0;
  const fragment = document.createDocumentFragment();
  hourly.time.slice(startIndex, startIndex + 24).forEach((time, offset) => {
    const index = startIndex + offset;
    const [description, icon] = weatherDescription(hourly.weather_code[index]);
    const item = document.createElement('div');
    item.className = 'hour-item';
    item.setAttribute('aria-label', `${timeLabel(time, { hour: 'numeric' })}, ${description}, ${temperature(hourly.temperature_2m[index])}${unitSymbol()}, ${hourly.precipitation_probability[index] ?? 0}% chance of rain`);
    item.innerHTML = `<span class="hour-time">${offset === 0 ? 'Now' : timeLabel(time, { hour: 'numeric' })}</span>${weatherIcon(icon, true, true)}<strong class="hour-temp">${temperature(hourly.temperature_2m[index])}°</strong><span class="hour-rain">${hourly.precipitation_probability[index] ?? 0}% rain</span>`;
    fragment.append(item);
  });
  elements.hourly.replaceChildren(fragment);
}

function renderWeek(weather) {
  const daily = weather.daily;
  const fragment = document.createDocumentFragment();
  daily.time.forEach((date, index) => {
    const [description, icon] = weatherDescription(daily.weather_code[index]);
    const row = document.createElement('div');
    row.className = 'day-row';
    row.innerHTML = `<span class="day-name">${dayLabel(date, index)}</span>${weatherIcon(icon)}<span class="day-description">${description}</span><strong class="day-high">${temperature(daily.temperature_2m_max[index])}°</strong><span class="day-low">${temperature(daily.temperature_2m_min[index])}°</span>`;
    fragment.append(row);
  });
  elements.week.replaceChildren(fragment);
}

function closeSearch() {
  elements.searchResults.hidden = true;
  elements.searchInput.setAttribute('aria-expanded', 'false');
}

function showSearchMessage(message) {
  const paragraph = document.createElement('p');
  paragraph.className = 'search-message';
  paragraph.textContent = message;
  elements.searchResults.replaceChildren(paragraph);
  elements.searchResults.hidden = false;
  elements.searchInput.setAttribute('aria-expanded', 'true');
}

async function searchLocations(query) {
  state.searchController?.abort();
  const controller = new AbortController();
  state.searchController = controller;
  const params = new URLSearchParams({ name: query, count: '6', language: 'en', format: 'json' });
  showSearchMessage('Searching…');
  try {
    const result = await fetchJson(`${GEOCODING_URL}?${params}`, controller.signal);
    if (controller.signal.aborted) return;
    const locations = result.results ?? [];
    if (!locations.length) {
      showSearchMessage('No cities found. Try another spelling.');
      return;
    }
    elements.searchResults.replaceChildren();
    locations.forEach((place) => {
      const button = document.createElement('button');
      button.className = 'search-result';
      button.type = 'button';
      button.setAttribute('role', 'option');
      const name = document.createElement('strong');
      name.textContent = place.name;
      const detail = document.createElement('span');
      detail.textContent = [place.admin1, place.country].filter(Boolean).join(', ');
      button.append(name, detail);
      button.addEventListener('click', () => selectLocation(place));
      elements.searchResults.append(button);
    });
    elements.searchResults.hidden = false;
    elements.searchInput.setAttribute('aria-expanded', 'true');
  } catch (error) {
    if (error.name !== 'AbortError') showSearchMessage('City search is unavailable. Please try again.');
  }
}

function selectLocation(place) {
  state.location = {
    name: place.name || 'Your location',
    admin1: place.admin1 || '',
    country: place.country || '',
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
  };
  safeSet(STORAGE_KEYS.location, JSON.stringify(state.location));
  elements.searchInput.value = '';
  closeSearch();
  updateLocationHeader();
  loadForecast();
}

async function locateUser() {
  if (!navigator.geolocation) {
    setStatus('Location is not available in this browser. Search for a city instead.', 'error');
    return;
  }
  elements.locateButton.disabled = true;
  setStatus('Finding your location…');
  navigator.geolocation.getCurrentPosition(async (position) => {
    const { latitude, longitude } = position.coords;
    let place = { name: 'Your location', country: '', latitude, longitude };
    try {
      const params = new URLSearchParams({ latitude, longitude, localityLanguage: 'en' });
      const reverse = await fetchJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`, AbortSignal.timeout(5000));
      place = { ...place, name: reverse.city || reverse.locality || reverse.principalSubdivision || place.name, admin1: reverse.principalSubdivision || '', country: reverse.countryName || '' };
    } catch { /* Coordinates still provide a complete forecast if reverse lookup fails. */ }
    elements.locateButton.disabled = false;
    selectLocation(place);
  }, (error) => {
    elements.locateButton.disabled = false;
    const message = error.code === error.PERMISSION_DENIED ? 'Location permission was denied. Search for a city instead.' : 'Could not determine your location. Try again or search for a city.';
    setStatus(message, 'error');
  }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
}

elements.searchInput.addEventListener('input', () => {
  clearTimeout(state.searchTimer);
  const query = elements.searchInput.value.trim();
  if (query.length < 2) {
    state.searchController?.abort();
    closeSearch();
    return;
  }
  state.searchTimer = setTimeout(() => searchLocations(query), 280);
});

elements.searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const firstResult = elements.searchResults.querySelector('.search-result');
  if (firstResult && !elements.searchResults.hidden) firstResult.click();
  else if (elements.searchInput.value.trim().length >= 2) searchLocations(elements.searchInput.value.trim());
});

elements.searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeSearch();
  if (event.key === 'ArrowDown' && !elements.searchResults.hidden) {
    event.preventDefault();
    elements.searchResults.querySelector('.search-result')?.focus();
  }
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.search-wrap')) closeSearch();
});

document.querySelectorAll('[data-unit]').forEach((button) => {
  button.addEventListener('click', () => {
    state.unit = button.dataset.unit;
    safeSet(STORAGE_KEYS.unit, state.unit);
    setUnits();
  });
});

elements.favoriteButton.addEventListener('click', toggleFavorite);
elements.refreshButton.addEventListener('click', () => loadForecast());
elements.locateButton.addEventListener('click', locateUser);
window.addEventListener('online', () => {
  elements.offlineIndicator.classList.remove('is-offline');
  setStatus('Back online. Refreshing forecast…', 'success');
  loadForecast({ quiet: true });
});
window.addEventListener('offline', () => {
  elements.offlineIndicator.classList.add('is-offline');
  setStatus('You are offline. Showing the last saved forecast if available.', 'error');
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  state.deferredInstall = event;
  elements.installButton.hidden = false;
});

elements.installButton.addEventListener('click', async () => {
  if (!state.deferredInstall) return;
  state.deferredInstall.prompt();
  await state.deferredInstall.userChoice;
  state.deferredInstall = null;
  elements.installButton.hidden = true;
});

window.addEventListener('appinstalled', () => {
  elements.installButton.hidden = true;
  setStatus('Weatherline is installed on this device.', 'success');
});

document.querySelector('#footer-year').textContent = new Date().getFullYear();
setUnits();
renderFavorites();
updateLocationHeader();
loadForecast();
window.setInterval(() => {
  if (navigator.onLine) loadForecast({ quiet: true });
}, 15 * 60 * 1000);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}