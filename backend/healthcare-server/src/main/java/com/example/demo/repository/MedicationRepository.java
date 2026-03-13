package com.example.demo.repository;

import com.example.demo.entity.UserMedication;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface MedicationRepository extends JpaRepository<UserMedication, Long> {
    List<UserMedication> findByUser_UserIdAndIsActiveTrue(String userId);
    Optional<UserMedication> findByIdAndUser_UserId(Long id, String userId);
}
