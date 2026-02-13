package com.example.demo.repository;

import com.example.demo.entity.User;
import com.example.demo.entity.UserHealth;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserHealthRepository extends JpaRepository<UserHealth, Long> {
    
    // ✅ 유저 객체로 요약 정보(UserHealth)를 찾는 메소드
    // (JPA가 메소드 이름을 보고 자동으로 쿼리를 만들어줍니다)
    Optional<UserHealth> findByUser(User user);
}