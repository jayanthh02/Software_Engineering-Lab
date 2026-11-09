import math

import pytest
from hypothesis import given, strategies as st
from irrigation_scheduler import parse_zone, moisture_average, water_needed


# FUZZ TEST 1: PARSE ZONE
# Any text or None must either give a valid (name, area) or raise ValueError.
@given(st.text() | st.none())
def test_parse_zone_no_crash(s):
    try:
        name, area = parse_zone(s)
        assert isinstance(name, str) and name
        assert isinstance(area, float)
        assert math.isfinite(area) and area > 0
    except ValueError:
        pass


@given(st.from_regex(r"[a-z]{1,10}:[1-9][0-9]{0,3}(\.[0-9]{1,2})?", fullmatch=True))
def test_parse_zone_valid_inputs(s):
    name, area = parse_zone(s)
    assert name == s.split(":")[0].strip().title()
    assert area == float(s.split(":")[1])


def test_parse_zone_examples():
    assert parse_zone("north:120") == ("North", 120.0)
    assert parse_zone("  south field : 45.5 ") == ("South Field", 45.5)


# FUZZ TEST 2: MOISTURE AVERAGE
@given(st.text() | st.none())
def test_moisture_average_no_crash(s):
    try:
        result = moisture_average(s)
        assert isinstance(result, int)
        assert 0 <= result <= 100
    except ValueError:
        pass


@given(st.lists(st.integers(min_value=0, max_value=100), min_size=1, max_size=20))
def test_moisture_average_valid_inputs(values):
    csv = ",".join(str(v) for v in values)
    assert moisture_average(csv) == sum(values) // len(values)


def test_moisture_average_examples():
    assert moisture_average("40,35,50") == 41
    assert moisture_average(" 60 ") == 60


# FUZZ TEST 3: WATER NEEDED
@given(st.text() | st.none())
def test_water_needed_no_crash(s):
    try:
        result = water_needed(s)
        assert isinstance(result, float)
        assert math.isfinite(result) and result >= 0
    except ValueError:
        pass


@given(st.floats(min_value=0, max_value=10000), st.floats(min_value=0, max_value=1000))
def test_water_needed_valid_inputs(area, rain):
    assert water_needed(f"{area}|{rain}") == max(area * 5 - rain, 0)


def test_water_needed_examples():
    assert water_needed("120|8") == 592.0
    assert water_needed("1|10") == 0.0


# INVALID INPUTS FOUND BY FUZZING (regression tests)
@pytest.mark.parametrize("bad", [None, "", "north", "a:b:c", ":10", "north:", "north:abc",
                                 "north:-5", "north:0", "north:nan", "north:inf"])
def test_parse_zone_rejects_bad_input(bad):
    with pytest.raises(ValueError):
        parse_zone(bad)


@pytest.mark.parametrize("bad", [None, "", ",", "40,,50", "a,b", "4.5", "-1", "101"])
def test_moisture_average_rejects_bad_input(bad):
    with pytest.raises(ValueError):
        moisture_average(bad)


@pytest.mark.parametrize("bad", [None, "", "120", "1|2|3", "x|5", "120|", "-1|5", "10|-2", "nan|1", "inf|0"])
def test_water_needed_rejects_bad_input(bad):
    with pytest.raises(ValueError):
        water_needed(bad)
