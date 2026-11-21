import re

_SEAT_RE = re.compile(r"([A-Za-z])([0-9]+)")


def _require_str(value, name):
    if not isinstance(value, str):
        raise ValueError(f"{name} must be a string")
    return value


def parse_seat(seat):
    """Parse a seat like 'H12' -> ('H', 12). Raises ValueError if invalid."""
    seat = _require_str(seat, "seat").strip()
    match = _SEAT_RE.fullmatch(seat)
    if not match:
        raise ValueError("seat must be one letter followed by a number, e.g. H12")
    number = int(match.group(2))
    if number < 1:
        raise ValueError("seat number must be at least 1")
    return match.group(1).upper(), number


def total_price(prices_csv):
    """Sum comma-separated prices and add 18% GST. Raises ValueError if invalid."""
    prices_csv = _require_str(prices_csv, "prices")
    prices = [int(p) for p in prices_csv.split(',')]  # ValueError on empty/non-numeric
    if any(p < 0 for p in prices):
        raise ValueError("prices cannot be negative")
    return round(sum(prices) * 1.18, 2)


def average_rating(ratings):
    """Average of space-separated ratings (each 1-5). Raises ValueError if invalid."""
    ratings = _require_str(ratings, "ratings")
    values = [int(r) for r in ratings.split()]
    if not values:
        raise ValueError("at least one rating is required")
    if any(v < 1 or v > 5 for v in values):
        raise ValueError("ratings must be between 1 and 5")
    return round(sum(values) / len(values), 1)


def main():
    try:
        print("==== Running parse_seat ====")
        user_input = input("Enter a seat number (e.g. H12): ")
        print("Row and Seat:", parse_seat(user_input))

        print("\n==== Running total_price ====")
        user_input = input("Enter ticket prices as CSV (e.g. 150,250,400): ")
        print("Total with GST:", total_price(user_input))

        print("\n==== Running average_rating ====")
        user_input = input("Enter ratings separated by spaces (e.g. 4 5 3): ")
        print("Average Rating:", average_rating(user_input))
    except ValueError as err:
        print("Invalid input:", err)


if __name__ == "__main__":
    main()
