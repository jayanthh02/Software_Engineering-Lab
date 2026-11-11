import pytest
from pizza_order import pizza_price, order_discount, delivery_status


# PIZZA PRICE: TRUE AND FALSE BRANCHES
@pytest.mark.parametrize(
    "size,toppings,cheese,expected",
    [
        ("small", 0, False, 200),
        ("medium", 3, False, 470),
        ("large", 5, False, 680),
        ("medium", 2, True, 530),
        ("large", 0, True, 600),
    ],
)
def test_valid_pizza_branches(size, toppings, cheese, expected):
    assert pizza_price(size, toppings, cheese) == expected


def test_invalid_size_branch():
    with pytest.raises(ValueError):
        pizza_price("invalid", 0, False)


def test_negative_toppings_branch():
    with pytest.raises(ValueError):
        pizza_price("small", -2, False)


def test_small_cheese_burst_branch():
    with pytest.raises(ValueError):
        pizza_price("small", 1, True)


# ORDER DISCOUNT: ALL DECISION BRANCHES
@pytest.mark.parametrize(
    "total,day,student,expected",
    [
        (250, "monday", False, 0),
        (500, "tuesday", False, 250),
        (500, "saturday", False, 0),
        (500, "sunday", True, 50),
        (500, "monday", False, 50),
        (500, "monday", True, 100),
    ],
)
def test_discount_branches(total, day, student, expected):
    assert order_discount(total, day, student) == expected


# DELIVERY STATUS: ALL DECISION BRANCHES
@pytest.mark.parametrize(
    "minutes,distance,expected",
    [
        (20, 11, "not deliverable"),
        (30, 5, "on time"),
        (31, 5, "late"),
        (45, 5, "late"),
        (46, 5, "free pizza"),
    ],
)
def test_delivery_branches(minutes, distance, expected):
    assert delivery_status(minutes, distance) == expected
