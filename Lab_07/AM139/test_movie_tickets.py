"""
Lab 7 - Fuzz testing with Hypothesis
SRN: PES1UG24AM139

Contract used by the tests: for ANY input (any text, or None) each function
must either return a valid result or raise ValueError. Any other exception
(IndexError, TypeError, AttributeError, ZeroDivisionError, ...) is a bug.
"""
import math
import pytest
from hypothesis import given, strategies as st
from movie_tickets import parse_seat, total_price, average_rating


# ---------------- no-crash fuzz tests ----------------
@given(st.text() | st.none())
def test_parse_seat_no_crash(s):
    try:
        row, num = parse_seat(s)
    except ValueError:
        return
    assert len(row) == 1 and row.isalpha() and row.isupper()
    assert isinstance(num, int) and num >= 1


@given(st.text() | st.none())
def test_total_price_no_crash(s):
    try:
        result = total_price(s)
    except ValueError:
        return
    assert isinstance(result, float) and result >= 0 and math.isfinite(result)


@given(st.text() | st.none())
def test_average_rating_no_crash(s):
    try:
        result = average_rating(s)
    except ValueError:
        return
    assert 1 <= result <= 5


# ---------------- property tests on valid input ----------------
@given(st.sampled_from("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"),
       st.integers(min_value=1, max_value=10**6))
def test_parse_seat_valid_roundtrip(letter, n):
    assert parse_seat(f"{letter}{n}") == (letter.upper(), n)


@given(st.lists(st.integers(min_value=0, max_value=10**6), min_size=1))
def test_total_price_valid_includes_gst(prices):
    csv = ",".join(map(str, prices))
    assert total_price(csv) == round(sum(prices) * 1.18, 2)


@given(st.lists(st.integers(min_value=1, max_value=5), min_size=1))
def test_average_rating_valid_within_range(ratings):
    result = average_rating(" ".join(map(str, ratings)))
    assert min(ratings) <= result <= max(ratings)


# ---------------- explicit regression cases found by fuzzing ----------------
@pytest.mark.parametrize("bad", [None, "", " ", "A", "12", "A0", "A-1", "AB1", "1A"])
def test_parse_seat_rejects_bad(bad):
    with pytest.raises(ValueError):
        parse_seat(bad)


@pytest.mark.parametrize("bad", [None, "", ",", "100,", "abc", "-5,10"])
def test_total_price_rejects_bad(bad):
    with pytest.raises(ValueError):
        total_price(bad)


@pytest.mark.parametrize("bad", [None, "", "   ", "abc", "0", "6", "-1 3"])
def test_average_rating_rejects_bad(bad):
    with pytest.raises(ValueError):
        average_rating(bad)
