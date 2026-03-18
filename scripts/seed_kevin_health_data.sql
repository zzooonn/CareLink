-- ============================================================
-- 1년치 랜덤 건강 데이터 삽입 스크립트 (kevin 계정)
-- 실행: docker exec -i <db_container> psql -U postgres -d healthcare < seed_kevin_health_data.sql
-- ============================================================

DO $$
DECLARE
    v_user_id   BIGINT;
    v_days      INT := 365;
    i           INT;

    -- 측정값
    v_bp_sys    INT;
    v_bp_dia    INT;
    v_glucose   INT;
    v_hr        INT;
    v_ecg_risk  NUMERIC(4,3);
    v_ecg_abn   BOOLEAN;
    v_bp_abn    BOOLEAN;
    v_glc_abn   BOOLEAN;
    v_overall   BOOLEAN;
    v_anomaly   VARCHAR(50);
    v_reason    VARCHAR(255);
    v_measured  TIMESTAMP;

    -- 평균 계산용
    v_avg_sys   BIGINT;
    v_avg_dia   BIGINT;
    v_avg_glc   BIGINT;
    v_last_sys  BIGINT;
    v_last_dia  BIGINT;

BEGIN
    -- kevin 계정의 DB 내부 id 조회
    SELECT id INTO v_user_id FROM users WHERE user_id = 'kevin';

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'kevin 계정을 찾을 수 없습니다. users 테이블을 확인하세요.';
    END IF;

    RAISE NOTICE '>>> kevin user_id = %  데이터 삽입 시작', v_user_id;

    -- 기존 데이터 삭제 (재실행 시 중복 방지)
    DELETE FROM user_health_records WHERE user_id = v_user_id;
    DELETE FROM user_health_info    WHERE user_id = v_user_id;

    -- 365일치 × 하루 2회 = 730건
    FOR i IN 0..(v_days - 1) LOOP

        -- ── 오전 측정 ──────────────────────────────────────────
        -- 측정 시각: 오전 7~9시 (±30분 랜덤)
        v_measured := (NOW() - (i || ' days')::INTERVAL)::DATE
                      + INTERVAL '7 hours'
                      + ((random() * 120)::INT || ' minutes')::INTERVAL;

        -- 혈압: 계절/시즌 효과 + 랜덤. 약 15% 확률로 고혈압 구간
        v_bp_sys  := CASE WHEN random() < 0.15 THEN 140 + (random() * 25)::INT
                          WHEN random() < 0.05 THEN 80  + (random() * 10)::INT  -- 저혈압
                          ELSE 110 + (random() * 28)::INT END;
        v_bp_dia  := CASE WHEN v_bp_sys >= 140  THEN 90  + (random() * 15)::INT
                          WHEN v_bp_sys < 90    THEN 50  + (random() * 10)::INT
                          ELSE 65  + (random() * 22)::INT END;

        -- 혈당: 10% 고혈당, 5% 저혈당
        v_glucose := CASE WHEN random() < 0.10 THEN 200 + (random() * 80)::INT
                          WHEN random() < 0.05 THEN 50  + (random() * 20)::INT
                          ELSE 85 + (random() * 80)::INT END;

        -- 심박수: 60-100 bpm, 가끔 빠름
        v_hr      := CASE WHEN random() < 0.08 THEN 100 + (random() * 30)::INT
                          ELSE 60 + (random() * 38)::INT END;

        -- ECG: 5% 비정상
        v_ecg_risk := ROUND((random() * 0.45)::NUMERIC, 3);
        v_ecg_abn  := v_ecg_risk > 0.30;

        -- 이상 판정
        v_bp_abn  := (v_bp_sys >= 140 OR v_bp_dia >= 90 OR v_bp_sys < 90 OR v_bp_dia < 60);
        v_glc_abn := (v_glucose >= 200 OR v_glucose <= 70);
        v_overall := v_bp_abn OR v_glc_abn OR v_ecg_abn;

        v_anomaly := CASE
            WHEN v_bp_sys  >= 140 THEN 'HIGH_BP'
            WHEN v_bp_sys  < 90   THEN 'LOW_BP'
            WHEN v_glucose >= 200 THEN 'HIGH_GLUCOSE'
            WHEN v_glucose <= 70  THEN 'LOW_GLUCOSE'
            WHEN v_ecg_abn        THEN 'ECG_ABNORMAL'
            ELSE NULL END;

        v_reason := CASE
            WHEN v_anomaly = 'HIGH_BP'      THEN '수축기 혈압이 정상 범위를 초과했습니다'
            WHEN v_anomaly = 'LOW_BP'       THEN '수축기 혈압이 낮습니다'
            WHEN v_anomaly = 'HIGH_GLUCOSE' THEN '혈당이 200mg/dL 이상입니다'
            WHEN v_anomaly = 'LOW_GLUCOSE'  THEN '혈당이 70mg/dL 이하입니다'
            WHEN v_anomaly = 'ECG_ABNORMAL' THEN 'ECG 위험 점수가 높습니다'
            ELSE NULL END;

        INSERT INTO user_health_records (
            user_id, bp_sys, bp_dia, glucose, heart_rate,
            ecg_risk_score, ecg_abnormal, ecg_anomaly_type,
            bp_abnormal, glucose_abnormal, overall_abnormal,
            anomaly_type, anomaly_reason,
            bp_sys_diff_from_avg, bp_dia_diff_from_avg, glucose_diff_from_avg,
            measured_at
        ) VALUES (
            v_user_id, v_bp_sys, v_bp_dia, v_glucose, v_hr,
            v_ecg_risk, v_ecg_abn,
            CASE WHEN v_ecg_abn AND random() < 0.4 THEN 'AFIB'
                 WHEN v_ecg_abn AND random() < 0.5 THEN 'PVC'
                 WHEN v_ecg_abn THEN 'ST_CHANGE' ELSE 'NORMAL' END,
            v_bp_abn, v_glc_abn, v_overall,
            v_anomaly, v_reason,
            0, 0, 0,
            v_measured
        );

        -- ── 오후 측정 ──────────────────────────────────────────
        v_measured := (NOW() - (i || ' days')::INTERVAL)::DATE
                      + INTERVAL '19 hours'
                      + ((random() * 90)::INT || ' minutes')::INTERVAL;

        v_bp_sys  := CASE WHEN random() < 0.15 THEN 138 + (random() * 27)::INT
                          WHEN random() < 0.05 THEN 82  + (random() * 8)::INT
                          ELSE 108 + (random() * 30)::INT END;
        v_bp_dia  := CASE WHEN v_bp_sys >= 140  THEN 88  + (random() * 17)::INT
                          WHEN v_bp_sys < 90    THEN 52  + (random() * 8)::INT
                          ELSE 64 + (random() * 24)::INT END;

        v_glucose := CASE WHEN random() < 0.10 THEN 195 + (random() * 90)::INT
                          WHEN random() < 0.05 THEN 52  + (random() * 18)::INT
                          ELSE 90 + (random() * 75)::INT END;

        v_hr      := CASE WHEN random() < 0.08 THEN 98 + (random() * 32)::INT
                          ELSE 62 + (random() * 36)::INT END;

        v_ecg_risk := ROUND((random() * 0.45)::NUMERIC, 3);
        v_ecg_abn  := v_ecg_risk > 0.30;
        v_bp_abn   := (v_bp_sys >= 140 OR v_bp_dia >= 90 OR v_bp_sys < 90 OR v_bp_dia < 60);
        v_glc_abn  := (v_glucose >= 200 OR v_glucose <= 70);
        v_overall  := v_bp_abn OR v_glc_abn OR v_ecg_abn;

        v_anomaly := CASE
            WHEN v_bp_sys  >= 140 THEN 'HIGH_BP'
            WHEN v_bp_sys  < 90   THEN 'LOW_BP'
            WHEN v_glucose >= 200 THEN 'HIGH_GLUCOSE'
            WHEN v_glucose <= 70  THEN 'LOW_GLUCOSE'
            WHEN v_ecg_abn        THEN 'ECG_ABNORMAL'
            ELSE NULL END;

        v_reason := CASE
            WHEN v_anomaly = 'HIGH_BP'      THEN '수축기 혈압이 정상 범위를 초과했습니다'
            WHEN v_anomaly = 'LOW_BP'       THEN '수축기 혈압이 낮습니다'
            WHEN v_anomaly = 'HIGH_GLUCOSE' THEN '혈당이 200mg/dL 이상입니다'
            WHEN v_anomaly = 'LOW_GLUCOSE'  THEN '혈당이 70mg/dL 이하입니다'
            WHEN v_anomaly = 'ECG_ABNORMAL' THEN 'ECG 위험 점수가 높습니다'
            ELSE NULL END;

        INSERT INTO user_health_records (
            user_id, bp_sys, bp_dia, glucose, heart_rate,
            ecg_risk_score, ecg_abnormal, ecg_anomaly_type,
            bp_abnormal, glucose_abnormal, overall_abnormal,
            anomaly_type, anomaly_reason,
            bp_sys_diff_from_avg, bp_dia_diff_from_avg, glucose_diff_from_avg,
            measured_at
        ) VALUES (
            v_user_id, v_bp_sys, v_bp_dia, v_glucose, v_hr,
            v_ecg_risk, v_ecg_abn,
            CASE WHEN v_ecg_abn AND random() < 0.4 THEN 'AFIB'
                 WHEN v_ecg_abn AND random() < 0.5 THEN 'PVC'
                 WHEN v_ecg_abn THEN 'ST_CHANGE' ELSE 'NORMAL' END,
            v_bp_abn, v_glc_abn, v_overall,
            v_anomaly, v_reason,
            0, 0, 0,
            v_measured
        );

    END LOOP;

    -- user_health_info 집계 업데이트
    SELECT
        AVG(bp_sys)::BIGINT,
        AVG(bp_dia)::BIGINT,
        AVG(glucose)::BIGINT
    INTO v_avg_sys, v_avg_dia, v_avg_glc
    FROM user_health_records WHERE user_id = v_user_id;

    SELECT bp_sys, bp_dia
    INTO   v_last_sys, v_last_dia
    FROM   user_health_records
    WHERE  user_id = v_user_id
    ORDER  BY measured_at DESC
    LIMIT  1;

    INSERT INTO user_health_info (user_id, avg_bp_sys, avg_bp_dia, avg_glucose, last_bp_sys, last_bp_dia)
    VALUES (v_user_id, v_avg_sys, v_avg_dia, v_avg_glc, v_last_sys, v_last_dia)
    ON CONFLICT (user_id) DO UPDATE SET
        avg_bp_sys  = EXCLUDED.avg_bp_sys,
        avg_bp_dia  = EXCLUDED.avg_bp_dia,
        avg_glucose = EXCLUDED.avg_glucose,
        last_bp_sys = EXCLUDED.last_bp_sys,
        last_bp_dia = EXCLUDED.last_bp_dia;

    RAISE NOTICE '>>> 완료: %건 삽입, avg_bp=%/%, avg_glucose=%',
        v_days * 2, v_avg_sys, v_avg_dia, v_avg_glc;

END $$;
