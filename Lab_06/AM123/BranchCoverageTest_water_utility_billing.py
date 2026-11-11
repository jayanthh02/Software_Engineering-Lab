import pytest
from water_utility_billing import calculate_water_bill, check_meter_tampering


# Input validation branches
def test_accounts_not_list():
    with pytest.raises(ValueError):
        calculate_water_bill(None, 10)


def test_base_fee_negative():
    with pytest.raises(ValueError):
        calculate_water_bill([], -1)


# Active / inactive account branches
def test_inactive_account_branch():
    result = calculate_water_bill(
        [{"is_active": False}], 10
    )
    assert result["status"] == "NO_ACTIVITY"


def test_active_account_branch():
    result = calculate_water_bill(
        [{"is_active": True, "usage_blocks": [20]}], 10
    )
    assert result["total_billed"] == 40


# Usage <= 0 branches
def test_usage_zero_branch():
    result = calculate_water_bill(
        [{"is_active": True, "usage_blocks": [0]}], 10
    )
    assert result["total_billed"] == 10


def test_usage_positive_branch():
    result = calculate_water_bill(
        [{"is_active": True, "usage_blocks": [20]}], 10
    )
    assert result["total_billed"] == 40


# Usage > 100 branches
def test_usage_above_100():
    result = calculate_water_bill(
        [{"is_active": True, "usage_blocks": [120]}], 10
    )
    assert result["total_billed"] == 550


def test_usage_not_above_100():
    result = calculate_water_bill(
        [{"is_active": True, "usage_blocks": [80]}], 10
    )
    assert result["total_billed"] == 210


# Commercial / residential branches
def test_residential_high_usage_break():
    result = calculate_water_bill(
        [{
            "is_active": True,
            "is_commercial": False,
            "usage_blocks": [120, 20]
        }], 10
    )
    assert result["total_billed"] == 550


def test_commercial_high_usage():
    result = calculate_water_bill(
        [{
            "is_active": True,
            "is_commercial": True,
            "usage_blocks": [120]
        }], 10
    )
    assert result["total_billed"] == 430


# Usage > 50 and <= 100 / else branches
def test_usage_above_50():
    result = calculate_water_bill(
        [{"is_active": True, "usage_blocks": [60]}], 10
    )
    assert result["total_billed"] == 160


def test_usage_50_or_less():
    result = calculate_water_bill(
        [{"is_active": True, "usage_blocks": [50]}], 10
    )
    assert result["total_billed"] == 85


# Leak waiver branches
def test_waiver_condition_true():
    result = calculate_water_bill(
        [{
            "is_active": True,
            "is_commercial": True,
            "has_leak_waiver": True,
            "usage_blocks": [120]
        }], 10
    )
    assert result["total_billed"] == 380


def test_waiver_condition_false():
    result = calculate_water_bill(
        [{
            "is_active": True,
            "has_leak_waiver": True,
            "usage_blocks": [20]
        }], 10
    )
    assert result["total_billed"] == 40


def test_waiver_not_enabled():
    result = calculate_water_bill(
        [{"is_active": True, "usage_blocks": [20]}], 10
    )
    assert result["total_billed"] == 40


# Status branches
def test_excessive_flags_status():
    accounts = [
        {"is_active": True, "usage_blocks": [0]}
        for _ in range(6)
    ]
    result = calculate_water_bill(accounts, 10)
    assert result["status"] == "EXCESSIVE_FLAGS"


def test_no_activity_status():
    result = calculate_water_bill([], 0)
    assert result["status"] == "NO_ACTIVITY"


def test_normal_status():
    result = calculate_water_bill(
        [{"is_active": True, "usage_blocks": [20]}], 10
    )
    assert result["status"] == "NORMAL"


# Meter tampering branches
def test_empty_readings():
    assert check_meter_tampering([]) == "NO_DATA"


def test_non_empty_readings():
    assert check_meter_tampering([[1, 2, 3]]) == "CLEAR"


def test_negative_reading():
    assert check_meter_tampering([[-1, -2]]) == "TAMPER_SUSPECTED"


def test_single_negative_reading():
    assert check_meter_tampering([[-1]]) == "CLEAR"


def test_negative_counter_reset():
    assert check_meter_tampering([[-1, 2, -3]]) == "CLEAR"


def test_two_consecutive_negative_readings():
    assert check_meter_tampering([[1, -1, -2]]) == "TAMPER_SUSPECTED"