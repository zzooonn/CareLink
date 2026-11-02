-- V3: 원격 푸시 알림을 위한 Expo 푸시 토큰 저장
-- 한 사용자당 마지막으로 로그인한 기기 1대의 토큰을 저장한다.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS expo_push_token VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_users_expo_push_token ON users (expo_push_token);
