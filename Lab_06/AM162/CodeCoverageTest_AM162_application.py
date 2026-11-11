import pytest
from irrigation_scheduler import should_irrigate, water_volume, schedule


# SHOULD IRRIGATE TESTS
def test_wet_soil_no_irrigation():
    assert should_irrigate(70, 0, "seedling") is False


def test_heavy_rain_no_irrigation():
    assert should_irrigate(30, 12, "vegetative") is False


def test_dry_seedling_needs_water():
    assert should_irrigate(40, 0, "seedling") is True


def test_moist_seedling_no_water():
    assert should_irrigate(50, 0, "seedling") is False


def test_dry_flowering_needs_water():
    assert should_irrigate(50, 0, "flowering") is True


def test_light_rain_other_stage_no_water():
    assert should_irrigate(30, 6, "vegetative") is False


def test_dry_other_stage_needs_water():
    assert should_irrigate(30, 0, "vegetative") is True


# WATER VOLUME TESTS
def test_invalid_area():
    with pytest.raises(ValueError, match="invalid area"):
        water_volume(0, "seedling", 20)


def test_seedling_volume():
    assert water_volume(10, "seedling", 20) == 20


def test_flowering_volume():
    assert water_volume(10, "flowering", 20) == 50


def test_hot_day_volume():
    assert water_volume(10, "vegetative", 40) == 60


def test_cold_day_volume():
    assert water_volume(10, "vegetative", 5) == 20


# SCHEDULE TESTS
def test_schedule_skips_wet_zone_and_waters_dry_zone():
    zones = [
        ("north", 10, 70, 0, "seedling", 20),
        ("south", 10, 30, 0, "seedling", 20),
    ]
    assert schedule(zones, 100) == ["south"]


def test_schedule_stops_when_budget_runs_out():
    zones = [
        ("east", 10, 30, 0, "flowering", 20),
        ("west", 10, 30, 0, "seedling", 20),
    ]
    assert schedule(zones, 40) == []
