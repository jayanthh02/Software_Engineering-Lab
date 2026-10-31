# Lab 5: Issues Found in library_system.py

| # | Issue | Type | Tool / Rule | Line(s) in original | Severity | Description | Fix Approach |
|---|---|---|---|---|---|---|---|
| 1 | `eval()` on rule string | Security | Bandit B307, Pylint W0123 | 45 | Medium | `eval()` runs any Python code contained in the fine rule string. A crafted rule could execute commands on the machine. | Replaced `eval()` with `_eval_node`, an AST-based evaluator that accepts only numbers, the name `days`, and the operators + - * /. |
| 2 | Bare `except` that silently passes | Security / Bug | Bandit B110, Pylint W0702, Flake8 E722 | 21-22 | Low | `except:` catches every error, including `KeyboardInterrupt`, and `pass` hides the failure. A typo or bad input would disappear without a trace. | Removed the try/except. `return_book` now checks whether the loan exists and returns True or False. |
| 3 | Mutable default argument | Bug | Pylint W0102 | 9 | Medium | `dates=[]` is created once when the function is defined, so the same list is shared across every call and keeps growing. | Removed the unused parameter and print the borrow time directly. |
| 4 | Global statements | Design | Pylint W0603 | 28, 35 | Medium | `renewBook` and `load_records` change global variables, so state changes are hard to follow and test. | Stored the fine rate in a dict (`FINE_RATE`). `load_records` now updates `loans` in place with `clear()` and `update()`. |
| 5 | File opened without `with` | Resource / Reliability | Pylint R1732, W1514 | 34, 40 | Medium | If an error occurs, the file may never be closed. No encoding is given, so the result depends on the operating system. | Used `with open(..., encoding="utf-8")` in `load_records` and `save_records`. |
| 6 | Function name not snake_case | Style | Pylint C0103 | 27 | Low | `renewBook` does not follow PEP 8 naming. | Renamed to `renew_book`. |
| 7 | Missing docstrings | Style | Pylint C0114, C0116 | 1, 9, 16, 24, 27, 33, 39, 44, 47, 52 | Low | No module or function documentation. | Added a module docstring and a one-line docstring to each function. |
| 8 | Unused import | Style | Pylint W0611, Flake8 F401 | 2 | Low | `os` is imported but never used. | Removed the import. |
| 9 | Blank lines and line length | Style | Flake8 E302, E305, E501 | 9, 16, 24, 27, 33, 39, 44, 47, 52, 68, plus lines 14 and 31 | Low | Functions are not separated by two blank lines, and two lines are longer than 79 characters. | Added two blank lines between top-level definitions and wrapped long lines. |
| 10 | Old-style string formatting | Style | Pylint C0209 | 14 | Low | String concatenation with `+` is harder to read than necessary. | Replaced with f-strings. |
| 11 | Negative overdue days give a negative fine | Logic bug | Not flagged by tools | 22 (`calculate_fine`) | Medium | `calculate_fine(-3)` returns -6, which would reduce what a student owes. | `calculate_fine` now uses `max(0, days_overdue)`, so the fine is never negative. |
| 12 | Long renewal raises the fine for every student | Logic bug | Not flagged by tools | 27-29 (`renewBook`) | Medium | Changing the global rate affects all loans, not only the renewed book. | Rate is now stored in `FINE_RATE`. The shared-rate behaviour remains, so it is documented as a design limitation for discussion. |
| 13 | Book ID stored as a number | Input validation | Not flagged by tools | 58 (`main`) | Low | `add_book_loan("S103", 4521)` accepts a number where a string ID is expected. | Not fixed in code. The demo call is kept to show the issue. Covered in reflection. |

## Summary

- Issues 1 to 10 were found by Bandit, Pylint, or Flake8.
- Issues 11 to 13 were found by reading the output and testing the program. The tools did not flag them.
- Issues 1 to 5 are the high and medium severity fixes required by the lab.
