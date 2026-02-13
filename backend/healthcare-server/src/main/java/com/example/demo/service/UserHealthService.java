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
            if (record.getAnomalyType() == null) {
                record.setAnomalyType("HIGH_BP");
                record.setAnomalyReason("고혈압 기준치 초과");
            }
        } else if (req.getBpSys() < 90 || req.getBpDia() < 60) {
            record.setBpAbnormal(true);
            if (record.getAnomalyType() == null) {
                record.setAnomalyType("LOW_BP");
                record.setAnomalyReason("저혈압 기준치 미만");
            }
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
            if (record.getAnomalyType() == null) {
                record.setAnomalyType("HIGH_GLUCOSE");
                record.setAnomalyReason("혈당 기준치 초과");
            }
        } else if (req.getGlucose() <= 70) {
            record.setGlucoseAbnormal(true);
            if (record.getAnomalyType() == null) {
                record.setAnomalyType("LOW_GLUCOSE");
                record.setAnomalyReason("혈당 기준치 미만");
            }
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

    // ECG가 이상인데 anomalyType 비어있으면(혈압/혈당에서 이미 채웠을 수도 있으니)
    if (Boolean.TRUE.equals(record.getEcgAbnormal())) {
        if (record.getAnomalyType() == null) {
            record.setAnomalyType("ECG_ABNORMAL");
            record.setAnomalyReason("ECG 이상 감지");
        }
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
}