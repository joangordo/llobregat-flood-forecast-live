"""One forecast cycle with a fake ACA API and a stand-in model."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import ClassVar

import numpy as np
import pandas as pd

from app import run as app_run

NOW = datetime(2026, 11, 20, 12, 7, tzinfo=UTC)
CONFIG = "config/sant_joan_despi.yaml"


class FakeClient:
    def __init__(self, q: pd.Series):
        self.q = q

    def observations_range(self, provider, sensor, start, end):
        if sensor != "CALC001261":
            return []
        s = self.q[(self.q.index >= pd.Timestamp(start)) & (self.q.index <= pd.Timestamp(end))]
        return [{"time": int(t.timestamp() * 1000), "value": f"{v:.3f}"} for t, v in s.items()]


class StubModel:
    """Forecast = current flow × (1 + h/10); intervals ±20 % and ±30 %."""

    manifest: ClassVar[dict] = {
        "features": ["q_now", "q_lag_1h"],
        "inputs": {},
        "input_ranges": {"q": {"p99": 400.0, "p95": 150.0, "max": 1400.0}},
        "thresholds": {"warning_m3s": 60.0},
        "train_years": [2001, 2025],
        "calibration_years": [2026],
        "created": "2026-11-25T00:00:00+00:00",
        "versions": {"llobregat-flood-forecasting": "1.0.0"},
    }

    def predict(self, X: pd.DataFrame) -> pd.DataFrame:
        out = []
        for h in (1.0, 3.0, 6.0):
            c = X["q_now"].to_numpy() * (1 + h / 10)
            df = pd.DataFrame(
                {
                    "issue_time": X.index,
                    "horizon_h": h,
                    "target_time": X.index + pd.Timedelta(hours=h),
                    "q_now": X["q_now"].to_numpy(),
                    "central": c,
                    "lo80": 0.8 * c,
                    "hi80": 1.2 * c,
                    "lo90": 0.7 * c,
                    "hi90": 1.3 * c,
                }
            )
            df["threshold_m3s"] = 60.0
            df["alert"] = df["central"] > 60
            df["pre_alert"] = df["hi90"] > 60
            out.append(df)
        return pd.concat(out, ignore_index=True)


def test_one_cycle_writes_the_page_data_and_the_archive(tmp_path, monkeypatch):
    monkeypatch.setattr(app_run.OperationalModel, "load", staticmethod(lambda d: StubModel()))
    t = pd.date_range("2026-10-01", "2026-11-20 12:05", freq="5min", tz="UTC")
    q = pd.Series(20 + 30 * np.exp(-(((np.arange(len(t)) - len(t) + 30) / 40.0) ** 2)), index=t)
    store, site = tmp_path / "store", tmp_path / "site"
    payload = app_run.run(
        CONFIG, tmp_path, store, site, client=FakeClient(q), now=NOW, history_h=12
    )
    saved = json.loads((site / "data" / "latest.json").read_text())
    assert saved == payload
    assert payload["issue_time"] == "2026-11-20T12:00:00Z"
    assert [f["h"] for f in payload["forecast"]] == [1.0, 3.0, 6.0]
    assert payload["level"] in {"pre_alert", "alert"}  # the flood near the end
    assert payload["observed"][-1][0] == "2026-11-20T12:00:00Z"
    assert set(payload["past"]) == {"1", "3", "6"}
    assert {r["key"] for r in payload["inputs"]} >= {"q"}
    arch = pd.read_parquet(store / "archive" / "forecasts_2026-11.parquet")
    assert len(arch) == 3
    # A second cycle at the same time does not duplicate the archive
    app_run.run(CONFIG, tmp_path, store, site, client=FakeClient(q), now=NOW, history_h=12)
    assert len(pd.read_parquet(store / "archive" / "forecasts_2026-11.parquet")) == 3


def test_no_target_data_means_no_forecast(tmp_path, monkeypatch):
    monkeypatch.setattr(app_run.OperationalModel, "load", staticmethod(lambda d: StubModel()))
    empty = pd.Series(dtype=float, index=pd.DatetimeIndex([], tz="UTC"))
    payload = app_run.run(
        CONFIG, tmp_path, tmp_path / "store", tmp_path / "site", client=FakeClient(empty), now=NOW
    )
    assert payload["level"] == "unknown" and payload["messages"] == ["no_target"]
    assert payload["forecast"] == []
