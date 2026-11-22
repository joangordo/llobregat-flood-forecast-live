# Operational model

This folder holds the model files produced by
[llobregat-flood-forecasting](https://github.com/joangordo/llobregat-flood-forecasting):

```bash
# in llobregat-flood-forecasting, with the data in data/
uv run llobregat operational-model --variant long
# then copy data/processed/sant_joan_despi/long/operational/* to this folder
```

Expected files: `manifest.json`, `h<h>_lgbm.txt.gz`, `h<h>_q05.txt.gz`, `h<h>_q10.txt.gz`,
`h<h>_q90.txt.gz`, `h<h>_q95.txt.gz` and `h<h>_ridge.joblib` for each lead time, plus the
importance tables. The Ridge files are scikit-learn pipelines: the app must install the same
scikit-learn version that trained them (listed in `manifest.json` under `versions`).
