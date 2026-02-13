package com.example.demo.dto;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateUserDiseaseRequest {
    private String userId;  // ✅ String으로 변경 (로그인 ID)
    private String diseaseName;
    private String diseaseCode;
    private LocalDateTime diagnosedAt;
}
