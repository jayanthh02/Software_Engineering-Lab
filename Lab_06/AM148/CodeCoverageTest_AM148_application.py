import pytest
from pizza_order import pizza_price, order_discount, delivery_status


# PIZZA PRICE TESTS
def test_unknown_size():
    with pytest.raises(ValueError, match="unknown size"):
        pizza_price("extra-large", 1, False)


def test_negative_toppings():
    with pytest.raises(ValueError, match="invalid toppings"):
        pizza_price("medium", -1, False)


def test_more_than_three_toppings():
    assert pizza_price("large", 4, False) == 650


def test_cheese_burst_small_not_allowed():
    with pytest.raises(ValueError, match="cheese burst not available for small"):
        pizza_price("small", 1, True)


def test_cheese_burst_medium():
    assert pizza_price("medium", 0, True) == 450


# ORDER DISCOUNT TESTS
def test_order_below_300():
    assert order_discount(250, "monday", False) == 0


def test_tuesday_student_discount():
    assert order_discount(500, "tuesday", True) == 300


def test_weekend_discount():
    assert order_discount(500, "sunday", False) == 0


def test_weekday_student_discount():
    assert order_discount(500, "monday", True) == 100


# DELIVERY STATUS TESTS
def test_not_deliverable():
    assert delivery_status(20, 11) == "not deliverable"


def test_on_time_delivery():
    assert delivery_status(30, 5) == "on time"


def test_late_delivery():
    assert delivery_status(40, 5) == "late"


def test_free_pizza():
    assert delivery_status(50, 5) == "free pizza"

