import pytest
from hypothesis import given, strategies as st
from pizza_order import toppings_price, pizza_inches, split_bill


# FUZZ TEST 1: TOPPINGS PRICE
@given(st.one_of(st.text(), st.none()))
def test_toppings_price_no_crash(s):
    try:
        result = toppings_price(s)
        assert isinstance(result, int)
        assert result >= 0
    except ValueError:
        pass


def test_valid_toppings():
    assert toppings_price("cheese,olives") == 70
    assert toppings_price(" PANEER, onion ") == 70


# FUZZ TEST 2: PIZZA SIZE
@given(st.one_of(st.text(), st.none()))
def test_pizza_inches_no_crash(s):
    try:
        result = pizza_inches(s)
        assert result in (8, 10, 12)
    except ValueError:
        pass


def test_valid_pizza_sizes():
    assert pizza_inches("S") == 8
    assert pizza_inches("M") == 10
    assert pizza_inches("L") == 12
    assert pizza_inches(" m ") == 10


# FUZZ TEST 3: SPLIT BILL
@given(st.one_of(st.text(), st.none()))
def test_split_bill_no_crash(s):
    try:
        result = split_bill(s)
        assert isinstance(result, float)
        assert result >= 0
    except ValueError:
        pass


def test_valid_bill_split():
    assert split_bill("900/3") == 300.0
    assert split_bill("100/3") == 33.33
