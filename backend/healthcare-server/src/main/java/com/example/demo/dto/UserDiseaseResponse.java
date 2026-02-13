package com.example.demo.dto;

import java.time.LocalDateTime;

import com.example.demo.entity.UserDisease;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UserDiseaseResponse {
    private Long id;
    private String diseaseName;
    private String diseaseCode;
    private LocalDateTime diagnosedAt;

    public static UserDiseaseResponse from(UserDisease entity) {
        UserDiseaseResponse dto = new UserDiseaseResponse();
        dto.setId(entity.getId());
        dto.setDiseaseName(entity.getDiseaseName());
        dto.setDiseaseCode(entity.getDiseaseCode());
        dto.setDiagnosedAt(entity.getDiagnosedAt());
        return dto;
    }
}