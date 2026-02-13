package com.example.demo.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.demo.entity.UserDisease;

public interface UserDiseaseRepository extends JpaRepository<UserDisease, Long> {

    // ✅ User.userId(String 로그인 ID)로 검색
    @Query("SELECT ud FROM UserDisease ud WHERE ud.user.userId = :userId")
    List<UserDisease> findByUserUserId(@Param("userId") String userId);

    // 트렌드에서 targetGroup = diseaseCode 로 필터할 때 사용할 예정
    List<UserDisease> findByDiseaseCode(String diseaseCode);

    List<UserDisease> findAll();

    
}
