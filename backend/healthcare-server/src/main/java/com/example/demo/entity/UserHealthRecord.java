package com.example.demo.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "user_health_records")
public class UserHealthRecord {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // ---- 실제 측정값 ----
    @Column(nullable = true)
    private Long bpSys;

    @Column(nullable = true)
    private Long bpDia;


    @Column
    private Long glucose;    // 혈당 (필요 시만)

    // ---- 평균 대비 차이 (현재값 - 개인 평균) ----
    // 단위는 네가 정하면 됨 (절대값 or 퍼센트)
    @Column
    private Double bpSysDiffFromAvg;    // 수축기 평균 대비 차이

    @Column
    private Double bpDiaDiffFromAvg;    // 이완기 평균 대비 차이

    @Column
    private Double glucoseDiffFromAvg;  // 혈당 평균 대비 차이

    // ---- 이상 여부 플래그 ----
    @Column
    private Boolean bpAbnormal;         // 혈압 이상 여부

    @Column
    private Boolean glucoseAbnormal;    // 혈당 이상 여부

    @Column
    private Boolean overallAbnormal;    // 전체적으로 이번 측정이 이상인지

    // ---- ECG 요약 데이터 ----
    @Column
    private Long heartRate;        // 심박수

    @Column
    private Double ecgRiskScore;   // 모델 기반 리스크 점수 (0~1)

    @Column
    private Boolean ecgAbnormal;   // 심전도 이상 여부

    @Column(length = 50)
    private String ecgAnomalyType; // 예: "AFIB", "PVC", "NORMAL"


    // ---- 이상 종류 / 이유(선택) ----
    // 예) "HIGH_BP", "LOW_BP", "HIGH_GLUCOSE" 등
    @Column(length = 50)
    private String anomalyType;

    // 예) "수축기 혈압이 개인 평균보다 30mmHg 이상 높음"
    @Column(length = 255)
    private String anomalyReason;

    @CreationTimestamp
    private LocalDateTime measuredAt; // 언제 측정했는지
}
