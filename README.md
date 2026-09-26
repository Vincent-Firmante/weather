# Weatherline

A no-build, installable weather dashboard. It uses the free Open-Meteo forecast, geocoding, and air-quality APIs; no API key or server-side code is required.

## Run locally

Serve this folder over localhost (service workers and geolocation require a secure context):

```powershell
npx serve .
```

Open the local URL printed by the command. You can also use VS Code's Live Server extension.

## Deploy free

The site is static and can be deployed directly from this folder to GitHub Pages, Cloudflare Pages, or Netlify. No build command is needed; use the repository root as the publish directory. HTTPS is required for install prompts, geolocation, and the service worker. The forecast works without location permission by starting with London; users can search for another city.

## Features

- Current conditions, feels-like temperature, daily highs/lows, and a 24-hour outlook
- Seven-day forecast, sunrise/sunset, UV index, precipitation chance, wind, humidity, and US AQI
- City search, optional device location, saved places, and Celsius/Fahrenheit conversion
- Refresh, automatic 15-minute updates, cached last forecast, and offline app shell
- Responsive layout, keyboard-accessible search, and PWA install support

Weather data: [Open-Meteo](https://open-meteo.com/). Reverse geocoding for device location uses [BigDataCloud](https://www.bigdatacloud.com/).