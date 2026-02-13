package com.example.demo.repository;

import com.example.demo.entity.UserHealthAlert;
import com.example.demo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface UserHealthAlertRepository extends JpaRepository<UserHealthAlert, Long> {
    // 특정 유저(환자든 보호자든)가 받은 알림 목록 조회
    List<UserHealthAlert> findByReceiverOrderByCreatedAtDesc(User receiver);
}