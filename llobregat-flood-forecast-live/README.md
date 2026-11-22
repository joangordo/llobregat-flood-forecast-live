# Llobregat flood forecast · live

*[Català a sota](#català)*

Live, experimental flood forecast for the Llobregat River at Sant Joan Despí, updated every
30 minutes and published at **https://joangordo.github.io/llobregat-flood-forecast-live/**.

> **Not an official warning system.** For official information, see the
> [Agència Catalana de l'Aigua](https://aca.gencat.cat) and
> [Protecció Civil de Catalunya](https://interior.gencat.cat/ca/arees_dactuacio/proteccio_civil/).

Each run (GitHub Actions):

1. fetches the new 5-minute readings of the ACA real-time network (Sentilo API, no key
   needed): flow at Sant Joan Despí and six upstream gauges, three reservoirs and nine rain
   gauges;
2. rebuilds the 30-minute inputs exactly as in training (quality control, previous-day
   reservoir means, rain in mm) from a rolling 60-day cache;
3. forecasts the flow 1–24 h ahead with 80 % and 90 % intervals and a two-level warning
   (pre-alert: upper bound of the 90 % interval above the threshold; alert: forecast above
   it);
4. archives every forecast (for verification on new years) and publishes the page.

The model, its validation and its limitations are documented in
[llobregat-flood-forecasting](https://github.com/joangordo/llobregat-flood-forecasting)
(Catalan version: [llobregat-prediccio-crescudes](https://github.com/joangordo/llobregat-prediccio-crescudes)).

## Layout

```
app/run.py            one forecast cycle (python -m app.run)
config/               station configuration, including the real-time rain gauge sensors
model/                operational model files (see model/README.md)
site/                 static page (index.html, app.js, style.css); data/latest.json is written by the run
.github/workflows/    forecast.yml (every 30 min + external trigger), ci.yml
```

## Setup

1. Copy the operational model to `model/`. If it is retrained with other library versions,
   update the `scikit-learn` and `lightgbm` pins in `pyproject.toml` to those in
   `model/manifest.json`.
2. Settings → Pages → Source: **GitHub Actions**.
3. Optional, for punctual runs: an external scheduler (e.g. cron-job.org) calling
   `POST /repos/joangordo/llobregat-flood-forecast-live/actions/workflows/forecast.yml/dispatches`
   with `{"ref": "main"}` and a fine-grained token limited to this repository
   (Actions: read and write).

Run it locally: `uv sync && uv run python -m app.run`, then open `site/index.html` through a
local server (`python -m http.server -d site`).

Data: Agència Catalana de l'Aigua (open data). Code: MIT.

---

## Català

Predicció experimental de crescudes del Llobregat a Sant Joan Despí en temps real, cada 30
minuts, publicada a **https://joangordo.github.io/llobregat-flood-forecast-live/**.

> **No és un sistema oficial d'avís.** La informació oficial la donen l'Agència Catalana de
> l'Aigua i Protecció Civil de Catalunya.

Cada execució (GitHub Actions):

1. descarrega les lectures noves de 5 minuts de la xarxa en temps real de l'ACA (API
   Sentilo, sense clau): cabal a Sant Joan Despí i a sis estacions de dalt, tres
   embassaments i nou pluviòmetres;
2. refà les entrades de 30 minuts exactament com a l'entrenament (control de qualitat,
   mitjana del dia anterior dels embassaments, pluja en mm) a partir d'una memòria de 60 dies;
3. prediu el cabal d'1 a 24 h vista, amb intervals del 80 % i del 90 % i un avís de dos
   nivells (prealerta: el límit superior de l'interval del 90 % supera el llindar; alerta:
   la predicció el supera);
4. arxiva cada predicció (per verificar-les amb anys nous) i publica la pàgina.

El model, la validació i les limitacions s'expliquen a
[llobregat-prediccio-crescudes](https://github.com/joangordo/llobregat-prediccio-crescudes).
La pàgina té versió en català i en anglès (botons CA / EN).

Posada en marxa: copiar el model operatiu a `model/` i triar **GitHub Actions** com a font
de Pages.

Dades: Agència Catalana de l'Aigua (dades obertes). Codi: MIT.
