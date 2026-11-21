"""Meter data processor (Lab 7, hardened version).

Every function now accepts any input without raising an exception:
- sanitize_meter_id returns "" when the input is not text.
- parse_consumption_readings skips entries that are not whole numbers and
  returns [] when the input is not text.
- format_billing_summary returns None when the record is not valid.
"""

FORBIDDEN_METER_CHARS = "!@#$%"


def sanitize_meter_id(meter_id):
    """Remove the characters ! @ # $ % and return the ID in upper case.

    Returns "" if meter_id is not a string (for example None).
    """
    if not isinstance(meter_id, str):
        return ""
    for ch in FORBIDDEN_METER_CHARS:
        meter_id = meter_id.replace(ch, "")
    # Strip after removing the characters so no stray spaces are left behind.
    return meter_id.strip().upper()


def parse_consumption_readings(readings_csv):
    """Turn "10,25,30" into [10, 25, 30].

    Entries that are empty, negative, decimal or not plain digits are skipped.
    Returns [] if readings_csv is not a string.
    """
    if not isinstance(readings_csv, str):
        return []
    readings = []
    for item in readings_csv.split(','):
        item = item.strip()
        # isascii() rejects look-alike digits from other scripts, which int()
        # would otherwise accept. isdigit() rejects "", "-5", "1.5" and "1_0".
        if item.isascii() and item.isdigit():
            try:
                readings.append(int(item))
            except ValueError:
                # Python refuses to convert extremely long digit strings.
                pass
    return readings


def format_billing_summary(account_record):
    """Turn "Name:Usage:Zone" into a billing sentence.

    Returns None if the record is not a string, does not have exactly three
    fields, has an empty name or zone, or usage is not a whole number.
    """
    if not isinstance(account_record, str):
        return None
    parts = account_record.split(':')
    if len(parts) != 3:
        return None
    customer_name, units_text, zone = (p.strip() for p in parts)
    if not customer_name or not zone:
        return None
    if not (units_text.isascii() and units_text.isdigit()):
        return None
    try:
        units = int(units_text)
    except ValueError:
        return None
    return f"Customer {customer_name} billed {units * 2} USD in {zone}"


def main():
    try:
        print("==== Running sanitize_meter_id ====")
        raw_id = input("Enter a meter ID with prefixes (!,@,#,$,%): ")
        clean_id = sanitize_meter_id(raw_id)
        print("Sanitized Meter ID:", clean_id)

        print("\n==== Running parse_consumption_readings ====")
        csv_input = input("Enter consumption readings (e.g. 10,25,30): ")
        readings_list = parse_consumption_readings(csv_input)
        print("Parsed Readings:", readings_list)
        if not readings_list:
            print("No valid readings found.")

        print("\n==== Running format_billing_summary ====")
        summary_input = input("Enter account record (Name:Usage:Zone): ")
        summary = format_billing_summary(summary_input)
        if summary is None:
            print("Invalid account record. Use Name:Usage:Zone, "
                  "with usage as a whole number.")
        else:
            print("Billing Summary:", summary)
    except (EOFError, KeyboardInterrupt):
        print("\nInput ended. Exiting.")


if __name__ == "__main__":
    main()
