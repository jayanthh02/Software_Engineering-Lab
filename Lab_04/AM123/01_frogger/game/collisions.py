"""
collisions: frog-vs-vehicle collision detection.
"""

CELL_SIZE = 50


def check_collision(frog, vehicles):
    """
    Return True if the frog's rectangle overlaps any vehicle's rectangle.
    """
    frog_rect = frog.get_rect(CELL_SIZE)

    for vehicle in vehicles:
        vehicle_rect = vehicle.get_rect(CELL_SIZE)

        if frog_rect.colliderect(vehicle_rect):
            return True

    return False