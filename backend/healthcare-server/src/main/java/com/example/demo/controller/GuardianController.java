package com.example.demo.controller;

import com.example.demo.dto.ConnectedPatientResponseDto;
import com.example.demo.dto.GuardianConnectRequestDto;
import com.example.demo.security.AccessControlService;
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
    private final AccessControlService accessControlService;

    @PostMapping("/connect")
    public ResponseEntity<String> connectPatientGuardian(@RequestBody GuardianConnectRequestDto request) {
        // 반드시 환자 본인만 보호자 연결을 요청할 수 있음 (보호자가 임의로 환자에 연결하는 것 차단)
        accessControlService.ensureSelf(request.getPatientId());
        guardianService.connectGuardian(request.getPatientId(), request.getGuardianId(), request.getContactPhone());
        return ResponseEntity.ok("Guardian connected successfully");
    }

    @DeleteMapping("/disconnect")
    public ResponseEntity<Void> disconnectGuardian(
            @RequestParam String patientId,
            @RequestParam String guardianId) {
        accessControlService.ensureSelf(patientId);
        guardianService.disconnectGuardian(patientId, guardianId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/my-patients/{guardianId}")
    public ResponseEntity<List<ConnectedPatientResponseDto>> getMyPatients(@PathVariable String guardianId) {
        accessControlService.ensureGuardianSelf(guardianId);
        List<ConnectedPatientResponseDto> patients = guardianService.getMyPatients(guardianId);
        return ResponseEntity.ok(patients);
    }

    @GetMapping("/my-guardians/{patientId}")
    public ResponseEntity<List<ConnectedPatientResponseDto>> getMyGuardians(@PathVariable String patientId) {
        accessControlService.ensureSelfOrLinkedGuardian(patientId);
        List<ConnectedPatientResponseDto> guardians = guardianService.getMyGuardians(patientId);
        return ResponseEntity.ok(guardians);
    }
}
