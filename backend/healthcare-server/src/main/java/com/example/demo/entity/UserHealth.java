package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "user_health_info")
public class UserHealth {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user; //  User의 PK(id)를 FK로 사용 (1:1 관계)

    @Column
    private Long avgBpSys;

    @Column
    private Long avgBpDia;

    @Column
    private Long avgGlucose;
}
