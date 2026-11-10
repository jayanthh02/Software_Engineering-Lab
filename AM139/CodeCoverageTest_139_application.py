import unittest
from calculator import calculate_discount

class TestCodeCoverage139(unittest.TestCase):
    def test_calculate_discount_all_lines(self):
        result = calculate_discount(150, True)
        self.assertEqual(result, 150 * 0.85)

if __name__ == '__main__':
    unittest.main()
