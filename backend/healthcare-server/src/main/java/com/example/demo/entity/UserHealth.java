package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "user_health_info")       // 요약 정보(현재 상태)
public class UserHealth {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user; //  User의 PK(id)를 FK로 사용 (1:1 관계)

    private Long avgBpSys;    // 평균 수축기 혈압
    private Long avgBpDia;    // 평균 이완기 혈압
    private Long avgGlucose;  // 평균 혈당

    private Long lastBpSys;       // 최근 수축기 혈압? (현재값)
    private Long lastBpDia;       // 최근 이완기 혈압? (현재값)
}
