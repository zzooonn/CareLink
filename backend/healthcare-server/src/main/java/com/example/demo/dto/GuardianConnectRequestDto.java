package com.example.demo.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class GuardianConnectRequestDto {
    private String patientId;    // 연결을 요청하는 환자 ID
    private String guardianId;   // 등록하려는 보호자 ID
    private String contactPhone; // 환자가 저장하는 보호자 연락처 (선택)
}