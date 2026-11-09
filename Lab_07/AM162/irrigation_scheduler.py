import math


def _number(text, what):
    """Parse a finite float, or raise ValueError with a clear message."""
    try:
        value = float(text.strip())
    except ValueError:
        raise ValueError(f"{what} must be a number")
    if not math.isfinite(value):
        raise ValueError(f"{what} must be a finite number")
    return value


def parse_zone(text):
    if not isinstance(text, str):
        raise ValueError("zone must be text like north:120")

    parts = text.split(':')
    if len(parts) != 2:
        raise ValueError("zone must be text like north:120")

    name = parts[0].strip()
    if not name:
        raise ValueError("zone name is missing")

    area = _number(parts[1], "area")
    if area <= 0:
        raise ValueError("area must be greater than 0")
    return name.title(), area


def moisture_average(readings_csv):
    if not isinstance(readings_csv, str) or not readings_csv.strip():
        raise ValueError("readings must be comma-separated numbers")

    values = []
    for r in readings_csv.split(','):
        r = r.strip()
        if not r:
            raise ValueError("empty reading")
        try:
            value = int(r)
        except ValueError:
            raise ValueError("readings must be whole numbers")
        if value < 0 or value > 100:
            raise ValueError("moisture must be between 0 and 100")
        values.append(value)
    return sum(values) // len(values)


def water_needed(text):
    if not isinstance(text, str):
        raise ValueError("input must be text like 120|8")

    parts = text.split('|')
    if len(parts) != 2:
        raise ValueError("input must be text like 120|8")

    plot = _number(parts[0], "area")
    rain = _number(parts[1], "rainfall")
    if plot < 0 or rain < 0:
        raise ValueError("area and rainfall cannot be negative")

    need = plot * 5 - rain
    return float(max(need, 0))


def main():
    print("==== Running parse_zone ====")
    user_input = input("Enter zone:area in m2 (e.g. north:120): ")
    result = parse_zone(user_input)
    print("Zone and Area:", result)

    print("\n==== Running moisture_average ====")
    user_input = input("Enter moisture readings as CSV (e.g. 40,35,50): ")
    result = moisture_average(user_input)
    print("Average Moisture:", result)

    print("\n==== Running water_needed ====")
    user_input = input("Enter area|rainfall (e.g. 120|8): ")
    result = water_needed(user_input)
    print("Water Needed:", result)


if __name__ == "__main__":
    main()
