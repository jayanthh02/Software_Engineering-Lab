
"""
GameEngine: owns the frog and all vehicles, and runs one frame's worth
of game logic.
"""

import random
import pygame

from game.frog import Frog
from game.vehicle import Vehicle
from game.collisions import check_collision
from game.renderer import (
    GRID_COLS,
    GOAL_ROW,
    ROAD_ROWS,
    START_ROW,
    CELL_SIZE,
    WIDTH,
)

LANE_SPEEDS = [1.5, -2, 2, -2.5, 1.5, -2]
TESTING_MODE = True
ATTEMPT_TIME = 5 if TESTING_MODE else 30


class GameEngine:
    def __init__(self):
        self.lives = 3
        self.game_over = False
        self.score = 0

        # Goal message state
        self.won = False
        self.goal_message_time = 0

        # Countdown timer state
        self.attempt_start_time = pygame.time.get_ticks()

        self._build_entities()

    def _build_entities(self):
        start_col = GRID_COLS // 2

        self.frog = Frog(
            col=start_col,
            row=START_ROW,
            start_col=start_col,
            start_row=START_ROW,
            cols=GRID_COLS,
            start_row_limit=START_ROW,
        )

        frog_x_range = (
            start_col * CELL_SIZE,
            start_col * CELL_SIZE + CELL_SIZE,
        )

        self.vehicles = []

        for i, row in enumerate(ROAD_ROWS):
            speed = LANE_SPEEDS[i % len(LANE_SPEEDS)]
            vehicle_width = 40 if i % 2 == 0 else 70
            spacing = 300
            count = 2

            # Avoid placing vehicles over the frog initially.
            for _attempt in range(20):
                phase = random.randint(0, spacing - 1)
                positions = []
                safe = True

                for n in range(count):
                    offset = phase + n * spacing
                    x = (
                        offset
                        if speed > 0
                        else WIDTH - offset - vehicle_width
                    )
                    positions.append(x)

                    if not (
                        x + vehicle_width <= frog_x_range[0]
                        or x >= frog_x_range[1]
                    ):
                        safe = False

                if safe:
                    break

            for x in positions:
                self.vehicles.append(
                    Vehicle(
                        x=x,
                        row=row,
                        width=vehicle_width,
                        height=CELL_SIZE - 8,
                        speed=speed,
                    )
                )

    def handle_keydown(self, key):
        # Restart the game with R.
        if key == pygame.K_r:
            self.lives = 3
            self.game_over = False
            self.score = 0
            self.won = False
            self.goal_message_time = 0
            self.attempt_start_time = pygame.time.get_ticks()
            self._build_entities()
            return

        # Ignore movement after Game Over.
        if self.game_over:
            return

        if key == pygame.K_UP:
            self.frog.move(0, -1)
        elif key == pygame.K_DOWN:
            self.frog.move(0, 1)
        elif key == pygame.K_LEFT:
            self.frog.move(-1, 0)
        elif key == pygame.K_RIGHT:
            self.frog.move(1, 0)

    def update(self):
        if self.game_over:
            return

        current_time = pygame.time.get_ticks()

        # Hide the goal message after one second.
        if self.won:
            elapsed = current_time - self.goal_message_time
            if elapsed >= 1000:
                self.won = False

        # Check whether the current attempt has timed out.
        elapsed_seconds = (
            current_time - self.attempt_start_time
        ) // 1000

        if elapsed_seconds >= ATTEMPT_TIME:
            self.lose_life()
            return

        # Move vehicles.
        for vehicle in self.vehicles:
            vehicle.update(road_width_px=WIDTH)

        # Handle vehicle collisions.
        if check_collision(self.frog, self.vehicles):
            self.lose_life()
            return

        # Handle successful goal completion.
        if self.frog.row == GOAL_ROW:
            self.score += 1
            self.won = True
            self.goal_message_time = current_time

            self.frog.reset()
            self.attempt_start_time = current_time

    def lose_life(self):
        self.lives -= 1
        self.won = False

        if self.lives <= 0:
            self.game_over = True
        else:
            self.frog.reset()
            self.attempt_start_time = pygame.time.get_ticks()

    def draw(self, surface, font):
        from game import renderer

        renderer.draw_scene(
            surface, self.frog, self.vehicles
        )

        renderer.draw_text(
            surface, font, f"Lives: {self.lives}", (10, 10)
        )

        renderer.draw_text(
            surface, font, f"Score: {self.score}", (10, 34)
        )

        # Display remaining attempt time.
        elapsed_seconds = (
            pygame.time.get_ticks() - self.attempt_start_time
        ) // 1000

        remaining = max(0, ATTEMPT_TIME - elapsed_seconds)

        renderer.draw_text(
            surface, font, f"Time: {remaining}", (10, 58)
        )

        # Temporary goal success message.
        if self.won:
            renderer.draw_banner(
                surface,
                font,
                f"GOAL REACHED! Score: {self.score}",
            )

        # Game Over takes priority.
        if self.game_over:
            renderer.draw_banner(
                surface,
                font,
                "GAME OVER - Press R to restart",
            )
