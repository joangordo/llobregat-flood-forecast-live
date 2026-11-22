"""One forecast cycle: fetch the new ACA readings, forecast, write the site data.

    python -m app.run [--config config/sant_joan_despi.yaml] [--model model]
                      [--store store] [--site site]

store/  persistent between runs (a `data` branch in GitHub Actions):
    cache/<series>.parquet          last CACHE_DAYS days of raw 5-min readings
    archive/forecasts_<YYYY-MM>.parquet   every forecast issued, for later verification
site/data/latest.json               what the web page shows
"""

from __future__ import annotations

import argparse
import json
import logging
import math
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd
from llobregat import live
from llobregat.config import load_station_config
from llobregat.operational import OperationalModel

log = logging.getLogger("app")

OBSERVED_HOURS = 72


def _num(x, nd: int = 2):
    if x is None:
        return None
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    return round(x, nd) if math.isfinite(x) else None


def _iso(t) -> str:
    return pd.Timestamp(t).tz_convert("UTC").isoformat().replace("+00:00", "Z")


def warning_level(latest: pd.DataFrame) -> str:
    if latest.empty:
        return "unknown"
    if latest["alert"].any():
        return "alert"
    if latest["pre_alert"].any():
        return "pre_alert"
    return "normal"


def build_payload(
    cfg, manifest: dict, fc: pd.DataFrame, table: pd.DataFrame, status: pd.DataFrame, now
) -> dict:
    """Everything the page needs, as plain JSON."""
    now = pd.Timestamp(now)
    q = table["q"].dropna()
    q = q[q.index >= now - pd.Timedelta(hours=OBSERVED_HOURS)]
    payload = {
        "generated": _iso(now),
        "station": {"id": cfg.station_id, "name": cfg.name},
        "threshold_m3s": _num(manifest["thresholds"]["warning_m3s"], 1),
        "model": {
            "version": manifest.get("versions", {}).get("llobregat-flood-forecasting"),
            "created": manifest.get("created"),
            "train_years": [manifest["train_years"][0], manifest["train_years"][-1]],
            "calibration_years": manifest.get("calibration_years"),
        },
        "observed": [[_iso(t), _num(v)] for t, v in q.items()],
        "inputs": json.loads(status.to_json(orient="records")) if len(status) else [],
        "issue_time": None,
        "q_now": None,
        "level": "unknown",
        "forecast": [],
        "past": {},
        "messages": [],
    }
    if fc.empty:
        payload["messages"].append("no_target")
        return payload
    issue = fc["issue_time"].max()
    latest = fc[fc["issue_time"] == issue].sort_values("horizon_h")
    payload["issue_time"] = _iso(issue)
    payload["q_now"] = _num(latest["q_now"].iloc[0])
    payload["level"] = warning_level(latest)
    payload["forecast"] = [
        {
            "h": _num(r.horizon_h, 1),
            "target_time": _iso(r.target_time),
            "central": _num(r.central),
            "lo80": _num(r.lo80),
            "hi80": _num(r.hi80),
            "lo90": _num(r.lo90),
            "hi90": _num(r.hi90),
            "alert": bool(r.alert),
            "pre_alert": bool(r.pre_alert),
        }
        for r in latest.itertuples()
    ]
    # Forecasts issued earlier whose target time has already passed: how did they do?
    for h, part in fc[fc["target_time"] <= issue].groupby("horizon_h"):
        payload["past"][f"{h:g}"] = [
            [_iso(r.target_time), _num(r.central), _num(r.lo80), _num(r.hi80)]
            for r in part.sort_values("target_time").itertuples()
        ]
    stale = [r["key"] for r in payload["inputs"] if (r.get("age_min") or 0) > 180]
    if stale:
        payload["messages"].append("stale_inputs")
    if issue < now - pd.Timedelta(hours=2):
        payload["messages"].append("old_target")
    return payload


def archive(fc: pd.DataFrame, store: Path) -> None:
    """Append the latest forecasts to the monthly archive (for verification on new years)."""
    if fc.empty:
        return
    issue = fc["issue_time"].max()
    latest = fc[fc["issue_time"] == issue]
    f = store / "archive" / f"forecasts_{pd.Timestamp(issue):%Y-%m}.parquet"
    f.parent.mkdir(parents=True, exist_ok=True)
    old = pd.read_parquet(f) if f.exists() else latest.iloc[:0]
    out = (
        pd.concat([old, latest], ignore_index=True)
        .drop_duplicates(["issue_time", "horizon_h"], keep="last")
        .sort_values(["issue_time", "horizon_h"])
    )
    out.to_parquet(f, index=False)


def run(
    config: Path,
    model_dir: Path,
    store: Path,
    site: Path,
    client=None,
    now: datetime | None = None,
    history_h: float = 48,
) -> dict:
    from llobregat.ingest.aca_sentilo import SentiloClient

    now = now or datetime.now(UTC).replace(microsecond=0)
    cfg = load_station_config(config)
    model = OperationalModel.load(model_dir)
    series = live.live_series(cfg, model.manifest.get("inputs", {}))
    raw = live.update_cache(series, store / "cache", client or SentiloClient(), now=now)
    fc, table = live.forecast(cfg, model, raw, series, now=now, history_h=history_h)
    status = live.input_status(series, raw, table, model.manifest.get("input_ranges", {}), now)
    payload = build_payload(cfg, model.manifest, fc, table, status, now)
    archive(fc, store)
    out = site / "data" / "latest.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    log.info(
        "Issue time %s, level %s, %d forecasts", payload["issue_time"], payload["level"], len(fc)
    )
    return payload


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--config", default="config/sant_joan_despi.yaml")
    p.add_argument("--model", default="model")
    p.add_argument("--store", default="store")
    p.add_argument("--site", default="site")
    p.add_argument("--history-h", type=float, default=48)
    args = p.parse_args(argv)
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    run(
        Path(args.config),
        Path(args.model),
        Path(args.store),
        Path(args.site),
        history_h=args.history_h,
    )


if __name__ == "__main__":
    main()
