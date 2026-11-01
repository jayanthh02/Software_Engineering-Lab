# Issues Found — museum_catalog.py (PES1UG24AM139)

Baseline: Pylint 4.85/10, Bandit 5 issues (1 Medium, 4 Low), Flake8 8 issues.
Final: Pylint 10.00/10, Bandit 0 issues, Flake8 0 issues.

| Issue | Type | Line(s) | Description | Fix Approach |
|-------|------|---------|-------------|--------------|
| SQL injection (B608) | Security (Medium) | 11 | `addArtifact` builds the INSERT by concatenating `title`, `era`, etc. A title like `x'); DROP TABLE artifacts;--` alters the query. | Use a parameterized query: `VALUES (?, ?, ?, ?)` with a tuple of values. |
| Shell command with `shell=True` (B602, B607, B404) | Security (Low) | 3, 37 | `subprocess.call("echo ...", shell=True)` spawns a shell and uses a partial executable path (`echo`) just to print a message. | Removed `subprocess`; use `print()`. Same output, no shell, no import. |
| Hardcoded password (B105) | Security (Low) | 7 | `CURATOR_PASSWORD = "m4seum!"` stores a secret in source control (and is never used). | Removed the constant. If auth is needed, read from an environment variable. |
| Unused argument `curator` (W0613) | Bug / Quality | 15 | `displayStatus(artifact_id, curator)` never uses `curator`. | Removed the parameter and updated the caller. |
| Crash on unknown id | Bug (found by review) | 16-17 | `fetchone()` returns `None` for a missing id, so `row[0]` raises `TypeError`. | Return `"not found"` when `row is None`. |
| Naming (C0103) x4 | Style | 10, 15, 24, 31, 36 | camelCase function names (`addArtifact`, `displayStatus`, `totalValue`, `moveToDisplay`, `backupNote`) violate PEP 8. | Renamed to snake_case and updated all call sites. |
| Missing docstrings (C0114, C0116) | Documentation | 1, 10, 15, 24, 31, 36, 40 | Module and every function lack docstrings. | Added a module docstring and one-line docstrings to each function. |
| Unnecessary `else` after `return` (R1705) | Quality | 17-20 | `if/else` where both branches return. | Flattened into sequential `if`/`return`. |
| Unused import (F401 / W0611) | Quality | 2 | `import datetime` is never used. | Removed the import. |
| Line too long (E501 / C0301) | Style | 6, 11, 16, 26, 32 | Lines up to 158 characters exceed the 79/100 limits. | Wrapped SQL strings and calls across lines. |
| Too many blank lines (E303) | Style | 24 | Three blank lines before `totalValue`. | Reduced to two. |
| Missing whitespace around operator (E225) | Style | 25 | `total=0` | Changed to `total = 0`. |
| Code runs on import | Design | 50 | `main()` was called at module level, so importing the module runs the demo. | Added `if __name__ == "__main__":` guard. |
