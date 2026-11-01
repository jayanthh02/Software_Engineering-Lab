# Reflection

> Note: edit the questions below to match the exact wording in your handout if it differs.

**1. Which issues were the easiest and which the hardest to fix?**
Style issues (E225, E303, unused import) were trivial and mechanical. The SQL injection fix was conceptually the most important but small in code: switching to `?` placeholders. The hardest part was renaming functions consistently, since every call site had to change too, and wrapping long SQL strings without altering the query.

**2. Did the tools report any false positives or issues you disagreed with?**
Bandit's B602/B607 on `echo ...` with `shell=True` were rated Low because the command is a constant, so it was not exploitable today. It still flags a risky pattern that becomes dangerous if someone later interpolates input, so I treated it as valid. The B105 hardcoded-password finding was also Low-confidence-ish: the constant was unused, but a secret in source is bad practice regardless.

**3. How would you integrate static analysis into your workflow?**
Run Flake8 and Pylint locally via pre-commit hooks, and run all three tools in CI (e.g. GitHub Actions) on every pull request, failing the build on Bandit Medium/High findings or a Pylint score below a threshold.

**4. What tangible improvements did you see after the fixes?**
Pylint went from 4.85 to 10.00, Bandit from 5 findings to 0 and Flake8 from 8 to 0. Beyond scores: the injection hole is closed, no secret lives in the source, the code follows PEP 8 naming, every function is documented, and the module can be imported without side effects. Review also surfaced a real crash (`None[0]` on an unknown id) that none of the tools flagged, so static analysis complements rather than replaces careful reading.
