package com.example.demo.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class GuardianConnectRequestDto {
    private String patientId;   // 연결을 요청하는 환자 ID
    private String guardianId;  // 등록하려는 보호자 ID
}