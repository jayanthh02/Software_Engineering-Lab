import json
import os
from datetime import datetime
import ast
import operator

# Global state
loans = {}
FINE_PER_DAY = 2

def add_book_loan(student_id, book_id, dates=[]):
    if not student_id:
        return
    dates.append(str(datetime.now()))
    loans[student_id] = loans.get(student_id, []) + [book_id]
    print("%s borrowed %s (loan dates on record: %d)" % (student_id, book_id, len(dates)))

def return_book(student_id, book_id):
    books = loans.get(student_id)
    if books is None or book_id not in books:
        return False
    books.remove(book_id)
    if not books:
        del loans[student_id]
    return True

def calculate_fine(days_overdue):
    return days_overdue * FINE_PER_DAY

def renewBook(student_id, book_id, extra_days):
    global FINE_PER_DAY
    if extra_days > 14:
        FINE_PER_DAY = FINE_PER_DAY + 1
    print("Renewed " + book_id + " for " + student_id + " by " + str(extra_days) + " days")

def load_records(file="loans.json"):
    f = open(file, "r")
    global loans
    loans = json.loads(f.read())
    f.close()

def save_records(file="loans.json"):
    f = open(file, "w")
    f.write(json.dumps(loans))
    f.close()

_BIN_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
}
_UNARY_OPS = {ast.USub: operator.neg, ast.UAdd: operator.pos}


def _eval_node(node, days):
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
    return _eval_node(ast.parse(rule, mode="eval"), days)

def print_report():
    print("Loan Report")
    for s in loans:
        print(s, "->", loans[s])

def main():
    add_book_loan("S101", "B-ALGO")
    add_book_loan("S102", "B-NETW")
    add_book_loan("", "B-DBMS")
    add_book_loan("S103", 4521)  # book id should be a string
    return_book("S999", "B-NONE")
    renewBook("S101", "B-ALGO", 21)
    print("Fine for 5 days:", calculate_fine(5))
    print("Fine for -3 days:", calculate_fine(-3))
    print("Fine via rule:", fine_from_rule("days * 2 + 10", 4))
    days = input("Days overdue for S102 (press Enter for 0): ") or "0"
    print("S102 owes:", calculate_fine(int(days)))
    save_records()
    load_records()
    print_report()

main()
