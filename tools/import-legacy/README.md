# import-legacy

One-off tools for moving the old SharePoint tracker's history into the app. Full explanation: `DOCUMENTATION.md` → *Importing the legacy tracker*.

```
node tools/import-legacy/inspect.mjs <file.xlsx>      # what sheets/columns exist and how each maps
node tools/import-legacy/import.mjs  <file.xlsx>      # DRY RUN — prints a full report, writes nothing
node tools/import-legacy/import.mjs  <file.xlsx> --show 3          # also print 3 example documents
node tools/import-legacy/import.mjs  <file.xlsx> --commit --service-account key.json --admin-uid <uid>
```

Run from the repo root (`xlsx` comes from the root `node_modules`; `firebase-admin` is only needed for `--commit`: `cd tools/import-legacy && npm install`).

Keep the spreadsheet and the service-account key out of git. The `--commit` path has not been run against a real project — try the emulator or a throwaway project first.
