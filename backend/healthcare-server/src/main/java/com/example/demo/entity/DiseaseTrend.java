package com.example.demo.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Table;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "disease_trend")
public class DiseaseTrend {


    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String diseaseName;    // 질병명
    private String diseaseCode;    // 표준 코드 (선택)

    private String region;         // 지역명 (시/도 단위 등)
    
    private Integer minAge;        // 대상 최소 나이
    private Integer maxAge;        // 대상 최대 나이
    private String targetGroup;    // "elderly", "child" 등

    private String keywords;       // 검색용 키워드 묶음

    private String riskLevel;      // "LOW", "MEDIUM", "HIGH"
    private String advisoryType;   // "NEWS", "VACCINE", "OUTBREAK"

    private String source;         // 예: "KCDC", "NewsAPI"
    private String sourceUrl;      // 원문 링크

    @Column(columnDefinition = "TEXT")
    private String advisoryText;   // 권고/요약 내용

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
