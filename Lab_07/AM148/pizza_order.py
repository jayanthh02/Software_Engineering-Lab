TOPPINGS = {"cheese": 40, "olives": 30, "onion": 20, "paneer": 50}
SIZES = {"S": 8, "M": 10, "L": 12}


def toppings_price(toppings_csv):
    if not isinstance(toppings_csv, str) or not toppings_csv.strip():
        raise ValueError("invalid toppings")

    total = 0
    for t in toppings_csv.split(','):
        topping = t.strip().lower()
        if not topping or topping not in TOPPINGS:
            raise ValueError("unknown topping")
        total += TOPPINGS[topping]
    return total


def pizza_inches(size):
    if not isinstance(size, str):
        raise ValueError("invalid size")

    size = size.strip().upper()
    if size not in SIZES:
        raise ValueError("unknown size")
    return SIZES[size]


def split_bill(text):
    if not isinstance(text, str):
        raise ValueError("invalid bill format")

    parts = text.split('/')
    if len(parts) != 2:
        raise ValueError("invalid bill format")

    try:
        total = int(parts[0].strip())
        people = int(parts[1].strip())
    except ValueError:
        raise ValueError("bill and people must be integers")

    if total < 0 or people <= 0:
        raise ValueError("invalid bill or number of people")

    return round(total / people, 2)


def main():
    print("==== Running toppings_price ====")
    user_input = input("Enter toppings as CSV (e.g. cheese,olives): ")
    result = toppings_price(user_input)
    print("Toppings Price:", result)

    print("\n==== Running pizza_inches ====")
    user_input = input("Enter pizza size (S/M/L): ")
    result = pizza_inches(user_input)
    print("Size in Inches:", result)

    print("\n==== Running split_bill ====")
    user_input = input("Enter total and people (e.g. 900/3): ")
    result = split_bill(user_input)
    print("Per Person:", result)


if __name__ == "__main__":
    main()
