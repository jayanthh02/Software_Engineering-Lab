"""Museum artifact catalog.

Register artifacts, track display status and total values by era.
"""
import sqlite3

conn = sqlite3.connect(":memory:")
conn.execute(
    "CREATE TABLE artifacts (id INTEGER PRIMARY KEY, title TEXT, "
    "era TEXT, value INTEGER, on_display INTEGER)"
)


def add_artifact(title, era, value, on_display=0):
    """Insert a new artifact into the catalog."""
    conn.execute(
        "INSERT INTO artifacts (title, era, value, on_display) "
        "VALUES (?, ?, ?, ?)",
        (title, era, value, on_display),
    )
    conn.commit()


def display_status(artifact_id):
    """Return 'on display', 'in storage' or 'not found' for an artifact."""
    row = conn.execute(
        "SELECT on_display FROM artifacts WHERE id = ?", (artifact_id,)
    ).fetchone()
    if row is None:
        return "not found"
    if row[0] == 1:
        return "on display"
    return "in storage"


def total_value(era):
    """Return the total value of all artifacts from the given era."""
    total = 0
    query = "SELECT value FROM artifacts WHERE era = ?"
    for (value,) in conn.execute(query, (era,)):
        total += value
    return total


def move_to_display(artifact_id):
    """Mark an artifact as on display."""
    conn.execute(
        "UPDATE artifacts SET on_display = 1 WHERE id = ?", (artifact_id,)
    )
    conn.commit()


def backup_note():
    """Print the backup completion notice."""
    print("catalog backup complete")


def main():
    """Run a short demonstration of the catalog."""
    add_artifact("Bronze Mirror", "Chola", 120000)
    add_artifact("Palm Manuscript", "Vijayanagara", 80000, 1)
    add_artifact("Terracotta Lamp", "Chola", 15000)
    move_to_display(1)
    print(display_status(1))
    print(total_value("Chola"))
    backup_note()


if __name__ == "__main__":
    main()
