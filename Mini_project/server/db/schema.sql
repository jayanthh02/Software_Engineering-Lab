-- Schema for SCP-8 (login). Later stories add proposals, approval_history,
-- notifications, events, registrations, tickets and checkins (see SAD 3.4).

CREATE TABLE IF NOT EXISTS clubs (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(60)  NOT NULL,
  role          ENUM('CLUB_LEAD','FACULTY','FINANCE','DEAN','ADMIN','STUDENT') NOT NULL,
  club_id       INT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_club FOREIGN KEY (club_id) REFERENCES clubs(id)
);

-- SCP-16 (SCP-F-009): in-app notifications.
-- proposal_id has no foreign key yet because the proposals table is added by a later story.
CREATE TABLE IF NOT EXISTS notifications (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  proposal_id INT          NULL,
  message     VARCHAR(255) NOT NULL,
  is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_notifications_user (user_id, is_read, created_at)
);
