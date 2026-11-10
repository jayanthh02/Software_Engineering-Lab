import unittest
from calculator import calculate_discount

class TestBranchCoverage139(unittest.TestCase):
    def test_member_expensive_item(self):
        result = calculate_discount(150, True)
        self.assertEqual(result, 150 * 0.85)

    def test_non_member_cheap_item(self):
        result = calculate_discount(50, False)
        self.assertEqual(result, 50 * 1.0)

    def test_member_cheap_item(self):
        result = calculate_discount(80, True)
        self.assertEqual(result, 80 * 0.90)

    def test_non_member_expensive_item(self):
        result = calculate_discount(120, False)
        self.assertEqual(result, 120 * 0.95)

if __name__ == '__main__':
    unittest.main()
