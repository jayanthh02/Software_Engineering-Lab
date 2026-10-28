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
