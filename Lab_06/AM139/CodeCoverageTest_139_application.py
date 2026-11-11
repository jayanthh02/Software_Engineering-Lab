import pytest
from movie_tickets import ticket_price, group_discount, snack_combo

# ---- Starter tests ----
def test_regular_afternoon():
    assert ticket_price("regular", 25, 15, False) == 150

def test_small_group():
    assert group_discount(2, False) == 0

# ---- ticket_price: error lines ----
def test_unknown_seat():
    with pytest.raises(ValueError):
        ticket_price("vip", 25, 15, False)

def test_invalid_hour_high():
    with pytest.raises(ValueError):
        ticket_price("regular", 25, 24, False)

# ---- ticket_price: time / weekend / age lines ----
def test_morning_discount():
    assert ticket_price("premium", 30, 10, False) == 200

def test_evening_surcharge():
    assert ticket_price("regular", 30, 20, False) == 180

def test_weekend_surcharge():
    assert ticket_price("regular", 30, 15, True) == 190

def test_infant_free():
    assert ticket_price("regular", 2, 15, False) == 0

def test_child_half_price():
    assert ticket_price("regular", 10, 15, False) == 75

# ---- group_discount ----
def test_zero_tickets():
    with pytest.raises(ValueError):
        group_discount(0, False)

def test_large_group():
    assert group_discount(10, False) == 15

def test_medium_group_student():
    assert group_discount(5, True) == 15

# ---- snack_combo ----
def test_small_snack():
    assert snack_combo("small", False) == 120

def test_medium_snack():
    assert snack_combo("medium", False) == 180

def test_large_snack_coupon():
    assert snack_combo("large", True) == 200
