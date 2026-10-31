"""Library fine and book renewal system.

Tracks which student borrowed which book, calculates overdue fines,
handles renewals, and saves or loads loan records as JSON.
"""

import ast
import json
import operator
from datetime import datetime

# Global state
loans = {}
FINE_RATE = {"per_day": 2}

_BIN_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
}
_UNARY_OPS = {ast.USub: operator.neg, ast.UAdd: operator.pos}


def add_book_loan(student_id, book_id):
    """Record that a student borrowed a book."""
    if not student_id:
        return
    borrowed_at = str(datetime.now())
    loans[student_id] = loans.get(student_id, []) + [book_id]
    print(f"{student_id} borrowed {book_id} at {borrowed_at}")


def return_book(student_id, book_id):
    """Remove a returned book. Returns True if the loan existed."""
    books = loans.get(student_id)
    if books is None or book_id not in books:
        return False
    books.remove(book_id)
    if not books:
        del loans[student_id]
    return True


def calculate_fine(days_overdue):
    """Return the fine for overdue days (never negative)."""
    return max(0, days_overdue) * FINE_RATE["per_day"]


def renew_book(student_id, book_id, extra_days):
    """Renew a book. Long renewals raise the fine rate."""
    if extra_days > 14:
        FINE_RATE["per_day"] += 1
    print(f"Renewed {book_id} for {student_id} by {extra_days} days")


def load_records(file="loans.json"):
    """Load loan records from a JSON file."""
    with open(file, "r", encoding="utf-8") as f:
        loans.clear()
        loans.update(json.load(f))


def save_records(file="loans.json"):
    """Save loan records to a JSON file."""
    with open(file, "w", encoding="utf-8") as f:
        json.dump(loans, f)


def _eval_node(node, days):
    """Safely evaluate a parsed arithmetic expression using 'days'."""
    if isinstance(node, ast.Expression):
        return _eval_node(node.body, days)
    if isinstance(node, ast.BinOp) and type(node.op) in _BIN_OPS:
        left = _eval_node(node.left, days)
        right = _eval_node(node.right, days)
        return _BIN_OPS[type(node.op)](left, right)
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY_OPS:
        return _UNARY_OPS[type(node.op)](_eval_node(node.operand, days))
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.Name) and node.id == "days":
        return days
    raise ValueError("unsupported term in fine rule")


def fine_from_rule(rule, days):
    """Evaluate a fine rule such as 'days * 2 + 10'."""
    return _eval_node(ast.parse(rule, mode="eval"), days)


def print_report():
    """Print every student's current loans."""
    print("Loan Report")
    for student, books in loans.items():
        print(student, "->", books)


def main():
    """Run the demo sequence."""
    add_book_loan("S101", "B-ALGO")
    add_book_loan("S102", "B-NETW")
    add_book_loan("", "B-DBMS")
    add_book_loan("S103", 4521)  # book id should be a string
    return_book("S999", "B-NONE")
    renew_book("S101", "B-ALGO", 21)
    print("Fine for 5 days:", calculate_fine(5))
    print("Fine for -3 days:", calculate_fine(-3))
    print("Fine via rule:", fine_from_rule("days * 2 + 10", 4))
    days = input("Days overdue for S102 (press Enter for 0): ") or "0"
    print("S102 owes:", calculate_fine(int(days)))
    save_records()
    load_records()
    print_report()


if __name__ == "__main__":
    main()