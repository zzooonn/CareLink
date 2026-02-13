package com.example.demo.controller;

import com.example.demo.dto.ConnectedPatientResponseDto;
import com.example.demo.dto.GuardianConnectRequestDto;
import com.example.demo.service.GuardianService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/guardian")
@RequiredArgsConstructor
public class GuardianController {

    private final GuardianService guardianService;

    // 1. 보호자 연결 요청 API
    @PostMapping("/connect")
    public ResponseEntity<String> connectPatientGuardian(@RequestBody GuardianConnectRequestDto request) {
        guardianService.connectGuardian(request.getPatientId(), request.getGuardianId());
        return ResponseEntity.ok("보호자 연결이 성공적으로 완료되었습니다.");
    }

    // 2. 내 환자 목록 조회 API (보호자용)
    @GetMapping("/my-patients/{guardianId}")
    public ResponseEntity<List<ConnectedPatientResponseDto>> getMyPatients(@PathVariable String guardianId) {
        List<ConnectedPatientResponseDto> patients = guardianService.getMyPatients(guardianId);
        return ResponseEntity.ok(patients);
    }

    @GetMapping("/my-guardians/{patientId}")
        public ResponseEntity<List<ConnectedPatientResponseDto>> getMyGuardians(@PathVariable String patientId) {
            List<ConnectedPatientResponseDto> guardians = guardianService.getMyGuardians(patientId);
            return ResponseEntity.ok(guardians);
    }
}