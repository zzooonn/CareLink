-- V1: user_guardian_links 테이블에 contact_phone 컬럼 추가
-- 환자가 저장한 보호자 연락처 (보호자 계정의 phone과 다를 수 있음)
-- baseline-on-migrate=true 설정으로 기존 DB에는 이 스크립트만 신규 적용됨

ALTER TABLE user_guardian_links
    ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
