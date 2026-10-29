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

-- SCP-14 (SCP-F-007), with the parts of SCP-F-003 / F-006 / F-008 it needs.
-- Shared proposals table: the submit story (SCP-F-003) adds its API on top of this
-- table instead of creating another one.
CREATE TABLE IF NOT EXISTS proposals (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  club_id             INT           NOT NULL,
  club_lead_id        INT           NOT NULL,
  event_name          VARCHAR(150)  NOT NULL,
  event_date          DATE          NOT NULL,
  venue               VARCHAR(150)  NOT NULL,
  expected_attendance INT           NOT NULL,
  budget              DECIMAL(10,2) NOT NULL,
  description         TEXT          NOT NULL,
  status              ENUM('PENDING_FACULTY','PENDING_FINANCE','PENDING_DEAN','APPROVED','REJECTED')
                      NOT NULL DEFAULT 'PENDING_FACULTY',
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_proposals_club FOREIGN KEY (club_id) REFERENCES clubs(id),
  CONSTRAINT fk_proposals_lead FOREIGN KEY (club_lead_id) REFERENCES users(id),
  INDEX idx_proposals_status (status, created_at)
);

-- Audit table for approval decisions (SCP-F-008, SCP-NF-005). The app never deletes rows here.
CREATE TABLE IF NOT EXISTS approval_history (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  proposal_id INT  NOT NULL,
  stage       ENUM('FACULTY','FINANCE','DEAN') NOT NULL,
  approver_id INT  NOT NULL,
  decision    ENUM('APPROVE','REJECT') NOT NULL,
  comment     VARCHAR(500) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_history_proposal FOREIGN KEY (proposal_id) REFERENCES proposals(id),
  CONSTRAINT fk_history_approver FOREIGN KEY (approver_id) REFERENCES users(id),
  INDEX idx_history_proposal (proposal_id, created_at)
);
