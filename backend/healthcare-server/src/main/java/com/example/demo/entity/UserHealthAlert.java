package com.example.demo.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "user_health_alert")
public class UserHealthAlert {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 이 알림이 어떤 "환자"의 상태에 대한 것인지
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private User patient;

    // 이 알림을 실제로 "누가" 받는지 (환자 본인 or 보호자)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "receiver_id", nullable = false)
    private User receiver;

    @Column(nullable = false)
    private String alertType;   // "DISEASE_TREND", "HEALTH_ANOMALY", "MEDICATION_REMINDER" 등

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, length = 1000)
    private String message;

    // 어떤 질병 트렌드 기반인지 (뉴스/예방접종 등)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "disease_trend_id")
    private DiseaseTrend diseaseTrend;

    // 어떤 측정 기록에서 이상이 나왔는지
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "health_record_id")
    private UserHealthRecord healthRecord;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime readAt;

}
