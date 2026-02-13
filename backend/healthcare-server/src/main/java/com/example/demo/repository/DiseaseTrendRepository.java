package com.example.demo.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.example.demo.entity.DiseaseTrend;

public interface DiseaseTrendRepository extends JpaRepository<DiseaseTrend, Long> {

    List<DiseaseTrend> findByRiskLevel(String riskLevel);

    void deleteByDiseaseCodeAndAdvisoryType(String diseaseCode, String advisoryType);

    List<DiseaseTrend> findByDiseaseCodeAndAdvisoryType(String diseaseCode, String advisoryType);

    List<DiseaseTrend> findTop5ByAdvisoryTypeOrderByIdDesc(String advisoryType);

    Page<DiseaseTrend> findByAdvisoryTypeOrderByIdDesc(String advisoryType, Pageable pageable);

    // 유저별 + 타입(NEWS) 최신순 페이징
    Page<DiseaseTrend> findByUser_IdAndAdvisoryTypeOrderByIdDesc(Long userPkId, String advisoryType, Pageable pageable);

    // 유저별 + 타입(NEWS) 최신 N개 (limit 고정 5)
    List<DiseaseTrend> findTop5ByUser_IdAndAdvisoryTypeOrderByIdDesc(Long userPkId, String advisoryType);

    // 유저별 + 타입(NEWS) 전체 삭제 (매일 갱신할 때 사용)
    void deleteByUser_IdAndAdvisoryType(Long userPkId, String advisoryType);

    // (선택) 유저별 + 질병코드 + 타입으로 삭제/조회 (더 정교하게 관리하고 싶을 때)
    void deleteByUser_IdAndDiseaseCodeAndAdvisoryType(Long userPkId, String diseaseCode, String advisoryType);

    List<DiseaseTrend> findByUser_IdAndDiseaseCodeAndAdvisoryType(Long userPkId, String diseaseCode, String advisoryType);
}
