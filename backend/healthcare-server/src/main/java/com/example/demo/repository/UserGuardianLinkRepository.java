package com.example.demo.repository;

import com.example.demo.entity.User;
import com.example.demo.entity.UserGuardianLink;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface UserGuardianLinkRepository extends JpaRepository<UserGuardianLink, Long> {
    
    List<UserGuardianLink> findByPatient(User patient);
    List<UserGuardianLink> findByGuardian(User guardian);
    boolean existsByPatientAndGuardian(User patient, User guardian);
}