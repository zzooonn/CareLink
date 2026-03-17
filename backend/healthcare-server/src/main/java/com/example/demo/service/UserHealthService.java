package com.example.demo.service;

import com.example.demo.dto.CreateHealthRecordRequest;
import com.example.demo.entity.User;
import com.example.demo.entity.UserHealth;
import com.example.demo.entity.UserHealthRecord;
import com.example.demo.repository.UserHealthRecordRepository;
import com.example.demo.repository.UserHealthRepository;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserHealthService {

    private final UserRepository userRepository;
    private final UserHealthRepository userHealthRepository; // 요약 정보
    private final UserHealthRecordRepository userHealthRecordRepository; // 기록 로그
    private final NotificationService notificationService;

    @Transactional
public void saveHealthRecord(CreateHealthRecordRequest req) {

    User user = userRepository.findByUserId(req.getUserId())
            .orElseThrow(() -> new RuntimeException("User not found"));

    UserHealth userHealth = userHealthRepository.findByUser(user)
            .orElseGet(() -> {
                UserHealth newHealth = new UserHealth();
                newHealth.setUser(user);
                return userHealthRepository.save(newHealth);
            });

    UserHealthRecord record = new UserHealthRecord();
    record.setUser(user);

    // --------------------
    // 1) 혈압 저장
    // --------------------
    if (req.getBpSys() != null && req.getBpDia() != null) {
        record.setBpSys(req.getBpSys());
        record.setBpDia(req.getBpDia());

        if (userHealth.getAvgBpSys() != null && userHealth.getAvgBpDia() != null) {
            record.setBpSysDiffFromAvg((double) (req.getBpSys() - userHealth.getAvgBpSys()));
            record.setBpDiaDiffFromAvg((double) (req.getBpDia() - userHealth.getAvgBpDia()));
        }

        if (req.getBpSys() >= 140 || req.getBpDia() >= 90) {
            record.setBpAbnormal(true);
            appendAnomaly(record, "HIGH_BP", "고혈압 기준치 초과");
        } else if (req.getBpSys() < 90 || req.getBpDia() < 60) {
            record.setBpAbnormal(true);
            appendAnomaly(record, "LOW_BP", "저혈압 기준치 미만");
        } else {
            record.setBpAbnormal(false);
        }
    }

    // --------------------
    // 2) 혈당 저장
    // --------------------
    if (req.getGlucose() != null) {
        record.setGlucose(req.getGlucose());

        if (userHealth.getAvgGlucose() != null) {
            record.setGlucoseDiffFromAvg((double) (req.getGlucose() - userHealth.getAvgGlucose()));
        }

        if (req.getGlucose() >= 200) {
            record.setGlucoseAbnormal(true);
            appendAnomaly(record, "HIGH_GLUCOSE", "혈당 기준치 초과");
        } else if (req.getGlucose() <= 70) {
            record.setGlucoseAbnormal(true);
            appendAnomaly(record, "LOW_GLUCOSE", "혈당 기준치 미만");
        } else {
            record.setGlucoseAbnormal(false);
        }
    }

    // --------------------
    // 3) ✅ ECG 저장 (추가!)
    // --------------------
    if (req.getHeartRate() != null) {
        record.setHeartRate(req.getHeartRate());
    }
    if (req.getEcgRiskScore() != null) {
        record.setEcgRiskScore(req.getEcgRiskScore());
    }
    if (req.getEcgAbnormal() != null) {
        record.setEcgAbnormal(req.getEcgAbnormal());
    }
    if (req.getEcgAnomalyType() != null) {
        record.setEcgAnomalyType(req.getEcgAnomalyType());
    }

    if (Boolean.TRUE.equals(record.getEcgAbnormal())) {
        appendAnomaly(record, "ECG_ABNORMAL", "ECG 이상 감지");
    }

    // --------------------
    // 4) ✅ overallAbnormal 계산 (추가!)
    // --------------------
    boolean overall =
            Boolean.TRUE.equals(record.getBpAbnormal())
            || Boolean.TRUE.equals(record.getGlucoseAbnormal())
            || Boolean.TRUE.equals(record.getEcgAbnormal());
    record.setOverallAbnormal(overall);

    // 저장
    userHealthRecordRepository.save(record);

    // 요약 업데이트
    updateUserHealthSummary(user, userHealth, req);

    // ✅ 이상값 종류별로 각각 알림 발송 (복수 이상값 모두 전달)
    if (Boolean.TRUE.equals(record.getBpAbnormal())) {
        String type = (req.getBpSys() >= 140 || req.getBpDia() >= 90) ? "HIGH_BP" : "LOW_BP";
        notificationService.sendEmergencyAlert(user, buildAlertTitle(type), buildAlertMessage(type, req), "HEALTH_ANOMALY");
    }
    if (Boolean.TRUE.equals(record.getGlucoseAbnormal())) {
        String type = req.getGlucose() >= 200 ? "HIGH_GLUCOSE" : "LOW_GLUCOSE";
        notificationService.sendEmergencyAlert(user, buildAlertTitle(type), buildAlertMessage(type, req), "HEALTH_ANOMALY");
    }
    if (Boolean.TRUE.equals(record.getEcgAbnormal())) {
        notificationService.sendEmergencyAlert(user, buildAlertTitle("ECG_ABNORMAL"), buildAlertMessage("ECG_ABNORMAL", req), "HEALTH_ANOMALY");
    }
}


    private void appendAnomaly(UserHealthRecord record, String type, String reason) {
        if (record.getAnomalyType() == null) {
            record.setAnomalyType(type);
            record.setAnomalyReason(reason);
        } else {
            record.setAnomalyType(record.getAnomalyType() + "," + type);
            record.setAnomalyReason(record.getAnomalyReason() + ", " + reason);
        }
    }

    private void updateUserHealthSummary(User user, UserHealth userHealth, CreateHealthRecordRequest req) {
        // 4-1. DB에서 해당 유저의 모든 기록 평균 다시 계산
        // (데이터가 많아지면 '최근 30일' 등으로 조건 추가 권장)
        
        // 혈압 평균 갱신
        if (req.getBpSys() != null) {
            List<Object[]> avgBp = userHealthRecordRepository.findAverageBpByUserId(user.getId());
            if (!avgBp.isEmpty() && avgBp.get(0)[0] != null) {
                Double avgSys = (Double) avgBp.get(0)[0];
                Double avgDia = (Double) avgBp.get(0)[1];
                
                userHealth.setAvgBpSys(Math.round(avgSys)); // 반올림해서 저장
                userHealth.setAvgBpDia(Math.round(avgDia));
            }
            // 최근 값 갱신
            userHealth.setLastBpSys(req.getBpSys());
            userHealth.setLastBpDia(req.getBpDia());
        }

        // 혈당 평균 갱신
        if (req.getGlucose() != null) {
            Double avgGlu = userHealthRecordRepository.findAverageGlucoseByUserId(user.getId());
            if (avgGlu != null) {
                userHealth.setAvgGlucose(Math.round(avgGlu));
            }
        }

        // 요약 테이블 저장 (UPDATE)
        userHealthRepository.save(userHealth);
    }

    private String buildAlertTitle(String anomalyType) {
        return switch (anomalyType) {
            case "HIGH_BP"      -> "⚠️ High Blood Pressure Detected";
            case "LOW_BP"       -> "⚠️ Low Blood Pressure Detected";
            case "HIGH_GLUCOSE" -> "⚠️ High Blood Glucose Detected";
            case "LOW_GLUCOSE"  -> "⚠️ Low Blood Glucose Detected";
            case "ECG_ABNORMAL" -> "⚠️ Abnormal ECG Detected";
            default             -> "⚠️ Abnormal Vital Signs Detected";
        };
    }

    private String buildAlertMessage(String anomalyType, CreateHealthRecordRequest req) {
        return switch (anomalyType) {
            case "HIGH_BP"      -> String.format("Blood pressure %d/%d mmHg exceeds normal range (≥140/90).", req.getBpSys(), req.getBpDia());
            case "LOW_BP"       -> String.format("Blood pressure %d/%d mmHg is below normal range (<90/60).", req.getBpSys(), req.getBpDia());
            case "HIGH_GLUCOSE" -> String.format("Blood glucose %d mg/dL exceeds normal range (≥200).", req.getGlucose());
            case "LOW_GLUCOSE"  -> String.format("Blood glucose %d mg/dL is below normal range (≤70).", req.getGlucose());
            case "ECG_ABNORMAL" -> "An abnormality was detected in the ECG reading. Please consult a healthcare provider.";
            default             -> "Abnormal vital signs were recorded. Please check the health data.";
        };
    }
}