-- V2: users 테이블에 누락된 컬럼 추가
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS blood_type        VARCHAR(10),
    ADD COLUMN IF NOT EXISTS allergies         TEXT,
    ADD COLUMN IF NOT EXISTS medical_conditions TEXT;
