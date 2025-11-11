package com.example.demo.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.CascadeType;
import com.example.demo.entity.Guardian;


@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "users")
public class User{

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String userId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String gender;

    @Column(nullable = false)
    private String birthDate;

    @Column(nullable = false)
    private String phone;

    @Column(nullable = false)
    private String address;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)      // user랑 보호자는 1:N의 관계를 가진다.
    private List<Guardian> guardians;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

}