package com.example.demo.dto.auth;

import com.example.demo.entity.UserHealth;
import com.example.demo.entity.UserHealthRecord;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class UserHealthResponse {

    // ---- 요약 테이블(UserHealth) 기반 ----
    private Long avgBpSys;
    private Long avgBpDia;
    private Long avgGlucose;
    private Long lastBpSys;
    private Long lastBpDia;

    // ---- 최신 기록(UserHealthRecord) 기반 (ECG) ----
    private Long heartRate;
    private Double ecgRiskScore;
    private Boolean ecgAbnormal;
    private String ecgAnomalyType;

    // (선택) 최신 기록 시간
    private LocalDateTime lastMeasuredAt;

    public UserHealthResponse(UserHealth health, UserHealthRecord latest) {

        if (health != null) {
            this.avgBpSys = health.getAvgBpSys();
            this.avgBpDia = health.getAvgBpDia();
            this.avgGlucose = health.getAvgGlucose();
            this.lastBpSys = health.getLastBpSys();
            this.lastBpDia = health.getLastBpDia();
        }

        if (latest != null) {
            this.heartRate = latest.getHeartRate();
            this.ecgRiskScore = latest.getEcgRiskScore();
            this.ecgAbnormal = latest.getEcgAbnormal();
            this.ecgAnomalyType = latest.getEcgAnomalyType();
            this.lastMeasuredAt = latest.getMeasuredAt();
        }
    }
}
