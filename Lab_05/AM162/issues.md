# Lab 5: Issues Found in todo_manager.py

Assigned repo: SETAPESU26/L5_37_todo_manager

| # | Issue | Type | Tool / Rule | Line(s) in original | Severity | Description | Fix Approach |
|---|---|---|---|---|---|---|---|
| 1 | Shell command built from user input | Security | Bandit B605 | 57 | High | `os.system("mail -s ... " + address + " < tasks.json")` passes `address` to a shell. An address like `a@b.com; rm -rf ~` would run a second command (command injection). | Removed `os.system`. `remind_by_email` now checks the address against an email pattern and sends the message with `smtplib` and `EmailMessage`, so no shell is involved. |
| 2 | Unsafe deserialisation with pickle | Security | Bandit B301, B403 | 3, 42, 47 | Medium | `pickle.load` can run arbitrary code if `tasks.pkl` is replaced with a crafted file. | Saved and loaded tasks as JSON (`tasks_data.json`) instead of pickle, and removed the `pickle` import. `load_tasks` converts the JSON string keys back to integer ids. |
| 3 | Mutable default argument | Bug | Pylint W0102 | 11, 13 | Medium | `labels=[]` is created once and shared by every call, so each new task appends its priority to the same list, which keeps growing. | Default is now `labels=None`. Each task stores its own copy with `list(labels or [])`. |
| 4 | Inconsistent return statements | Bug | Pylint R1710 | 33-36 | Medium | `findTask` returns an id when it finds a task, but otherwise falls off the end and returns `None` implicitly. | Added an explicit `return None` and documented it in the docstring. |
| 5 | `open` without an encoding | Reliability | Pylint W1514 | 41, 46, 51 | Medium | The file encoding depends on the operating system, so a file saved on one machine may not read correctly on another. | Every `open` now passes `encoding="utf-8"`. |
| 6 | `random` used to pick the next task | Security (false positive) / Design | Bandit B311 | 70 | Low | Bandit warns that `random` is not cryptographically secure. This is not a security use, but `random.choice` makes the suggestion unpredictable and crashes with `IndexError` if no tasks are pending. | Added `suggest_next()`, which returns the highest-priority pending task, or `None` if all are done. The output is now deterministic and testable. |
| 7 | Function, argument and variable names not snake_case | Style | Pylint C0103 | 11, 12, 19, 27, 33, 34, 40, 45, 50, 55 | Low | `addTask`, `taskId`, `fileName` and others do not follow PEP 8 naming. | Renamed to `add_task`, `task_id`, `file_name`, etc. |
| 8 | Missing docstrings | Style | Pylint C0114, C0116 | 1, 11, 19, 27, 33, 40, 45, 50, 55, 60 | Low | No module or function documentation. | Added a module docstring and a docstring for every function. |
| 9 | PEP 8 formatting | Style | Flake8 E225, E303, E261, E231 | 12, 40, 69, 74 | Low | Missing spaces around `=` and after `,`, three blank lines, and one space before an inline comment. | Fixed spacing and blank lines. Also wrapped one docstring that went over 79 characters (E501) after the Pylint changes. |
| 10 | Demo runs when the file is imported | Design | Not flagged by tools | 79 | Medium | `main()` is called at module level, so importing the file adds tasks and writes files. | Wrapped the call in `if __name__ == "__main__":`. |
| 11 | Unknown priority crashes later | Logic bug | Not flagged by tools | 11, 29 | Medium | `addTask("x", "urgent")` is accepted, but `pendingTasks()` then fails with `KeyError` when sorting. | `add_task` raises `ValueError` for any priority not in `PRIORITY_ORDER`. |
| 12 | Task id from `len(tasks) + 1` | Logic bug | Not flagged by tools | 12 | Low | If tasks were ever removed, or loaded with gaps in their ids, a new task could reuse an existing id and overwrite it. | New id is `max(tasks, default=0) + 1`. |

## Summary

- Issues 1 to 9 were found by Bandit, Pylint or Flake8. Issues 10 to 12 were found by reading the code; the tools did not flag them.
- High and medium severity issues (1 to 5, 10, 11) were fixed first.

| Tool | Before | After |
|---|---|---|
| Pylint | 5.09/10 (27 messages) | 10.00/10 |
| Bandit | 4 issues: 1 High, 1 Medium, 2 Low | No issues identified |
| Flake8 | 4 issues | 0 issues |

- One behaviour change: "Try this next" now suggests the highest-priority pending task instead of a random one (issue 6). Tasks are saved to `tasks_data.json` instead of `tasks.pkl` (issue 2). All other output is the same as before.
