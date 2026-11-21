"""Lab 7: fuzz tests for processor.py using Hypothesis.

Each fuzz test feeds generated input (random text, None, or text built to look
like real data) to one function and checks that the function never crashes.
If a function raises, the test fails and Hypothesis prints the smallest input
that caused the crash.
"""
from hypothesis import given, strategies as st

from processor import (
    sanitize_meter_id,
    parse_consumption_readings,
    format_billing_summary,
)

FORBIDDEN_CHARS = "!@#$%"


# ---------------------------------------------------------------------------
# Required tests: random text or None for each of the three functions
# ---------------------------------------------------------------------------

@given(st.text() | st.none())
def test_sanitize_meter_id_no_crash(s):
    try:
        result = sanitize_meter_id(s)
    except Exception as e:
        assert False, f"sanitize_meter_id crashed with: {e!r} (input: {s!r})"
    # The result must always be text with none of the forbidden characters.
    assert isinstance(result, str)
    assert not any(ch in result for ch in FORBIDDEN_CHARS)


@given(st.text() | st.none())
def test_parse_consumption_readings_safe(s):
    try:
        result = parse_consumption_readings(s)
    except Exception as e:
        assert False, f"parse_consumption_readings crashed with: {e!r} (input: {s!r})"
    # The result must always be a list of non-negative whole numbers.
    assert isinstance(result, list)
    assert all(isinstance(r, int) and r >= 0 for r in result)


@given(st.text() | st.none())
def test_format_billing_summary_safe(s):
    try:
        result = format_billing_summary(s)
    except Exception as e:
        assert False, f"format_billing_summary crashed with: {e!r} (input: {s!r})"
    # A summary string for a good record, or None for a bad one.
    assert result is None or isinstance(result, str)


# ---------------------------------------------------------------------------
# Extra fuzzing with structured inputs
#
# Random text almost never contains commas or two colons, so the tests above
# rarely reach the code that handles each field. These strategies build inputs
# that look like real "10,25,30" readings and "Name:Usage:Zone" records.
# ---------------------------------------------------------------------------

readings_like = st.lists(
    st.one_of(st.text(), st.integers().map(str)), max_size=8
).map(",".join)

record_like = st.one_of(
    st.lists(st.text(), max_size=5).map(":".join),
    st.builds(
        "{}:{}:{}".format,
        st.text(),
        st.one_of(st.integers().map(str), st.text()),
        st.text(),
    ),
)


@given(readings_like | st.none())
def test_parse_consumption_readings_structured(s):
    try:
        result = parse_consumption_readings(s)
    except Exception as e:
        assert False, f"parse_consumption_readings crashed with: {e!r} (input: {s!r})"
    assert isinstance(result, list)
    assert all(isinstance(r, int) and r >= 0 for r in result)


@given(record_like | st.none())
def test_format_billing_summary_structured(s):
    try:
        result = format_billing_summary(s)
    except Exception as e:
        assert False, f"format_billing_summary crashed with: {e!r} (input: {s!r})"
    assert result is None or isinstance(result, str)


# ---------------------------------------------------------------------------
# Hardening must not break normal behaviour
# ---------------------------------------------------------------------------

def test_valid_inputs_still_work():
    assert sanitize_meter_id("  !ab@c#12$% ") == "ABC12"
    assert parse_consumption_readings("10, 25,30") == [10, 25, 30]
    assert (
        format_billing_summary("Asha:40:North")
        == "Customer Asha billed 80 USD in North"
    )
