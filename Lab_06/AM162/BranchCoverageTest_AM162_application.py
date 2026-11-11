import pytest
from irrigation_scheduler import should_irrigate, water_volume, schedule


# SHOULD IRRIGATE: TRUE AND FALSE OUTCOME OF EVERY DECISION
@pytest.mark.parametrize(
    "moisture,rain,stage,expected",
    [
        (60, 0, "seedling", False),     # moisture >= 60 true (boundary)
        (59, 10, "seedling", False),    # rain >= 10 true (boundary)
        (44, 9, "seedling", True),      # seedling, moisture < 45 true
        (45, 0, "seedling", False),     # seedling, moisture < 45 false (boundary)
        (54, 0, "flowering", True),     # flowering, moisture < 55 true
        (55, 0, "flowering", False),    # flowering, moisture < 55 false (boundary)
        (30, 5, "vegetative", False),   # other stage, rain >= 5 true (boundary)
        (39, 4, "vegetative", True),    # other stage, moisture < 40 true
        (40, 4, "vegetative", False),   # other stage, moisture < 40 false (boundary)
    ],
)
def test_should_irrigate_branches(moisture, rain, stage, expected):
    assert should_irrigate(moisture, rain, stage) is expected


# WATER VOLUME: AREA CHECK, STAGE CHOICE AND TEMPERATURE CHOICE
@pytest.mark.parametrize("area", [0, -5])
def test_invalid_area_branch(area):
    with pytest.raises(ValueError, match="invalid area"):
        water_volume(area, "seedling", 20)


@pytest.mark.parametrize(
    "area,stage,temp,expected",
    [
        (10, "seedling", 20, 20),       # seedling, normal temperature
        (10, "flowering", 20, 50),      # flowering, normal temperature
        (10, "vegetative", 20, 40),     # other stage, normal temperature
        (10, "seedling", 36, 30),       # temp > 35 true
        (10, "seedling", 35, 20),       # temp > 35 false (boundary)
        (10, "flowering", 9, 25),       # temp < 10 true
        (10, "flowering", 10, 50),      # temp < 10 false (boundary)
    ],
)
def test_water_volume_branches(area, stage, temp, expected):
    assert water_volume(area, stage, temp) == expected


# SCHEDULE: LOOP, CONTINUE, BREAK AND APPEND
def test_schedule_empty_zone_list():
    assert schedule([], 100) == []


def test_schedule_all_zones_fit_in_budget():
    zones = [
        ("north", 10, 30, 0, "seedling", 20),
        ("south", 5, 30, 0, "vegetative", 20),
    ]
    assert schedule(zones, 100) == ["north", "south"]


def test_schedule_skips_zone_that_does_not_need_water():
    zones = [
        ("wet", 10, 70, 0, "seedling", 20),
        ("dry", 10, 30, 0, "seedling", 20),
    ]
    assert schedule(zones, 100) == ["dry"]


def test_schedule_breaks_when_budget_is_exceeded():
    zones = [
        ("first", 10, 30, 0, "seedling", 20),
        ("big", 10, 30, 0, "flowering", 20),
        ("last", 1, 30, 0, "seedling", 20),
    ]
    assert schedule(zones, 30) == ["first"]


def test_schedule_uses_exact_budget():
    zones = [("only", 10, 30, 0, "seedling", 20)]
    assert schedule(zones, 20) == ["only"]
