import pytest
from water_utility_billing import calculate_water_bill, check_meter_tampering


def test_invalid_accounts():
    with pytest.raises(ValueError):
        calculate_water_bill("invalid", 10)


def test_negative_base_fee():
    with pytest.raises(ValueError):
        calculate_water_bill([], -10)


def test_inactive_account():
    accounts = [{"is_active": False, "usage_blocks": [30]}]
    result = calculate_water_bill(accounts, 10)
    assert result["total_billed"] == 0
    assert result["status"] == "NO_ACTIVITY"


def test_account_defaults():
    accounts = [{}]
    result = calculate_water_bill(accounts, 10)
    assert result["total_billed"] == 0


def test_residential_low_usage():
    accounts = [{
        "is_active": True,
        "is_commercial": False,
        "usage_blocks": [30]
    }]
    result = calculate_water_bill(accounts, 10)
    assert result["total_billed"] == 55


def test_usage_between_50_and_100():
    accounts = [{
        "is_active": True,
        "is_commercial": False,
        "usage_blocks": [60]
    }]
    result = calculate_water_bill(accounts, 10)
    assert result["total_billed"] == 160


def test_non_positive_usage():
    accounts = [{
        "is_active": True,
        "usage_blocks": [0, -5]
    }]
    result = calculate_water_bill(accounts, 10)
    assert result["total_billed"] == 10


def test_residential_high_usage():
    accounts = [{
        "is_active": True,
        "is_commercial": False,
        "usage_blocks": [120, 30]
    }]
    result = calculate_water_bill(accounts, 10)
    assert result["total_billed"] == 550


def test_commercial_high_usage():
    accounts = [{
        "is_active": True,
        "is_commercial": True,
        "usage_blocks": [120]
    }]
    result = calculate_water_bill(accounts, 10)
    assert result["total_billed"] == 430


def test_leak_waiver_applied():
    accounts = [{
        "is_active": True,
        "is_commercial": True,
        "has_leak_waiver": True,
        "usage_blocks": [101]
    }]
    result = calculate_water_bill(accounts, 10)
    assert result["total_billed"] == 313.5


def test_leak_waiver_not_applied_below_threshold():
    accounts = [{
        "is_active": True,
        "has_leak_waiver": True,
        "usage_blocks": [30]
    }]
    result = calculate_water_bill(accounts, 10)
    assert result["total_billed"] == 55


def test_excessive_flags():
    accounts = [
        {"is_active": True, "usage_blocks": [0]}
        for _ in range(6)
    ]
    result = calculate_water_bill(accounts, 10)
    assert result["status"] == "EXCESSIVE_FLAGS"


def test_no_activity():
    result = calculate_water_bill([], 0)
    assert result["status"] == "NO_ACTIVITY"


def test_normal_status():
    accounts = [{
        "is_active": True,
        "usage_blocks": [30]
    }]
    result = calculate_water_bill(accounts, 10)
    assert result["status"] == "NORMAL"


def test_meter_no_data():
    assert check_meter_tampering([]) == "NO_DATA"


def test_meter_tampering_detected():
    assert check_meter_tampering([[1, -2, -3]]) == "TAMPER_SUSPECTED"


def test_meter_clear():
    assert check_meter_tampering([[1, -2, 3, -4]]) == "CLEAR"


def test_meter_negative_count_resets():
    assert check_meter_tampering([[-1, 2, -3]]) == "CLEAR"