import pytest
from movie_tickets import ticket_price, group_discount, snack_combo

# ================= ticket_price =================
# Validation: seat
def test_unknown_seat():
    with pytest.raises(ValueError, match="unknown seat"):
        ticket_price("vip", 25, 15, False)

# Validation: show_hour (both sides of the 'or', plus valid boundaries)
def test_hour_negative():
    with pytest.raises(ValueError, match="invalid show time"):
        ticket_price("regular", 25, -1, False)

def test_hour_too_high():
    with pytest.raises(ValueError, match="invalid show time"):
        ticket_price("regular", 25, 24, False)

@pytest.mark.parametrize("hour", [0, 23])
def test_hour_valid_boundaries(hour):
    assert ticket_price("regular", 25, hour, False) in (100, 180)

# Seat types
@pytest.mark.parametrize("seat,expected", [("regular", 150), ("premium", 250), ("recliner", 400)])
def test_all_seat_types_afternoon(seat, expected):
    assert ticket_price(seat, 25, 15, False) == expected

# Show-time branches: morning (<12), afternoon (12-17), evening (>=18)
def test_morning_discount():
    assert ticket_price("premium", 30, 10, False) == 200

def test_hour_11_is_morning():
    assert ticket_price("regular", 30, 11, False) == 100

def test_hour_12_is_afternoon():
    assert ticket_price("regular", 30, 12, False) == 150

def test_hour_17_is_afternoon():
    assert ticket_price("regular", 30, 17, False) == 150

def test_hour_18_is_evening():
    assert ticket_price("regular", 30, 18, False) == 180

# Weekend branch: True / False
def test_weekend_true():
    assert ticket_price("regular", 30, 15, True) == 190

def test_weekend_false():
    assert ticket_price("regular", 30, 15, False) == 150

# Age branches
def test_age_2_free():
    assert ticket_price("regular", 2, 15, False) == 0

def test_age_0_free():
    assert ticket_price("recliner", 0, 20, True) == 0

def test_age_3_half():
    assert ticket_price("regular", 3, 15, False) == 75

def test_age_12_half():
    assert ticket_price("regular", 12, 15, False) == 75

def test_age_13_full():
    assert ticket_price("regular", 13, 15, False) == 150

def test_age_59_full():
    assert ticket_price("regular", 59, 15, False) == 150

def test_age_60_senior_half():
    assert ticket_price("regular", 60, 15, False) == 75

def test_integer_division_rounding():
    # morning + weekend premium: 250-50+40 = 240 -> 120 for a child
    assert ticket_price("premium", 8, 9, True) == 120

# ================= group_discount =================
def test_zero_tickets():
    with pytest.raises(ValueError, match="no tickets"):
        group_discount(0, False)

def test_negative_tickets():
    with pytest.raises(ValueError):
        group_discount(-3, True)

def test_one_ticket():
    assert group_discount(1, False) == 0

def test_small_group():
    assert group_discount(2, False) == 0

def test_four_tickets_no_discount():
    assert group_discount(4, False) == 0

def test_five_tickets_10():
    assert group_discount(5, False) == 10

def test_nine_tickets_10():
    assert group_discount(9, False) == 10

def test_ten_tickets_15():
    assert group_discount(10, False) == 15

def test_student_group_small_no_bonus():
    assert group_discount(3, True) == 0

def test_student_group_medium_bonus():
    assert group_discount(5, True) == 15

def test_student_group_large_bonus():
    assert group_discount(10, True) == 20

# ================= snack_combo =================
@pytest.mark.parametrize("size,expected", [("small", 120), ("medium", 180), ("large", 250)])
def test_snack_sizes_no_coupon(size, expected):
    assert snack_combo(size, False) == expected

@pytest.mark.parametrize("size,expected", [("small", 70), ("medium", 130), ("large", 200)])
def test_snack_sizes_with_coupon(size, expected):
    assert snack_combo(size, True) == expected

def test_unknown_snack_size_falls_to_large():
    assert snack_combo("jumbo", False) == 250
