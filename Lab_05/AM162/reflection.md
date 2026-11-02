# Reflection

**1. Which issues were the easiest and which the hardest to fix?**

The easiest were the Flake8 formatting issues (missing spaces, extra blank lines) and the Pylint naming and docstring messages. Each one has a single obvious fix.

The hardest was the Bandit B605 command-injection issue in `remindByEmail`. The address could not simply be escaped, because the real problem was handing user input to a shell. I replaced `os.system` with `smtplib`, which sends the email without a shell, and validated the address first. Replacing pickle (B301) also took care: JSON turns integer dictionary keys into strings, so `load_tasks` has to convert the task ids back to integers, or `complete_task(2)` would stop working after a reload.

**2. Did the tools report any false positives or issues you disagreed with?**

Yes. Bandit B311 flags `random.choice` as unsuitable for cryptography, but picking a task to suggest has nothing to do with security. I still changed it, for a different reason: a random suggestion is hard to test and crashes on an empty list. The highest-priority pending task is a more useful suggestion anyway.

Bandit B403 (importing pickle) is also a weak signal on its own, since importing a module is not dangerous. The real risk is `pickle.load` on a file someone else could change (B301).

The tools also missed real problems: an unknown priority such as `"urgent"` crashes `pendingTasks()` with a `KeyError`, `main()` ran on import, and `len(tasks) + 1` can reuse an id. These were found only by reading the code.

**3. How would you integrate static analysis into your workflow?**

- Run Flake8 and Pylint in the editor on save, so style issues are fixed while writing code.
- Add Pylint (with a minimum score), Flake8 and Bandit as a CI step on every pull request, and block the merge on Bandit High or Medium findings.
- Use a pre-commit hook for Flake8 so badly formatted code never reaches the repository.
- Treat `# nosec` or disabled Pylint checks as something a reviewer must approve, with a comment explaining why.

**4. What tangible improvements did you see after the fixes?**

- Pylint went from 5.09/10 to 10.00/10. Flake8 went from 4 issues to 0, and Bandit from 4 issues (1 High, 1 Medium) to none.
- The command-injection risk and the unsafe pickle loading are gone.
- `add_task` no longer leaks labels between calls, rejects invalid priorities up front, and cannot reuse an id.
- The module can be imported and tested without running the demo, and every function has a docstring and a clear name, so the file is easier to read and change.
