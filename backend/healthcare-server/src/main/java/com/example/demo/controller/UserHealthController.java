package com.example.demo.controller;

import com.example.demo.dto.CreateHealthRecordRequest;
import com.example.demo.dto.InsightsResponse;
import com.example.demo.dto.auth.UserHealthResponse;
import com.example.demo.entity.User;
import com.example.demo.entity.UserHealth;
import com.example.demo.entity.UserHealthRecord;
import com.example.demo.repository.UserHealthRecordRepository;
import com.example.demo.repository.UserHealthRepository;
import com.example.demo.repository.UserRepository;
import com.example.demo.security.AccessControlService;
import com.example.demo.service.UserHealthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/vitals")
@RequiredArgsConstructor
public class UserHealthController {

    private final UserHealthService userHealthService;
    private final UserRepository userRepository;
    private final UserHealthRepository userHealthRepository;
    private final UserHealthRecordRepository userHealthRecordRepository;
    private final AccessControlService accessControlService;

    @PostMapping
    public ResponseEntity<String> addVitalMeasurement(@RequestBody CreateHealthRecordRequest req) {
        accessControlService.ensureSelfOrLinkedGuardian(req.getUserId());
        userHealthService.saveHealthRecord(req);
        return ResponseEntity.ok("Measurement saved and average updated.");
    }

    @GetMapping("/summary")
    @Transactional(readOnly = true)
    public ResponseEntity<UserHealthResponse> getUserHealthSummary(@RequestParam String userId) {
        accessControlService.ensureSelfOrLinkedGuardian(userId);

        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "user not found"));

        UserHealth userHealth = userHealthRepository.findByUser(user).orElse(null);
        UserHealthRecord latest = userHealthRecordRepository
                .findTopByUser_IdOrderByMeasuredAtDesc(user.getId())
                .orElse(null);

        if (userHealth == null && latest == null) {
            return ResponseEntity.noContent().build();
        }

        UserHealthResponse response = new UserHealthResponse(userHealth, latest);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/insights")
    public ResponseEntity<InsightsResponse> getInsights(
            @RequestParam String userId,
            @RequestParam(defaultValue = "7d") String range
    ) {
        accessControlService.ensureSelfOrLinkedGuardian(userId);

        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "user not found"));

        int days = switch (range) {
            case "30d" -> 30;
            case "365d" -> 365;
            default -> 7;
        };

        LocalDateTime end = LocalDateTime.now();
        LocalDateTime start = end.minusDays(days - 1L);

        List<UserHealthRecord> rows = userHealthRecordRepository
                .findByUser_IdAndMeasuredAtBetweenOrderByMeasuredAtAsc(user.getId(), start, end);

        InsightsResponse resp = InsightsResponse.from(rows, days);
        return ResponseEntity.ok(resp);
    }
}
