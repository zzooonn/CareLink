package com.example.demo.controller;

import com.example.demo.dto.CreateHealthRecordRequest;
import com.example.demo.dto.auth.UserHealthResponse; 
import com.example.demo.entity.User;
import com.example.demo.entity.UserHealth;
import com.example.demo.entity.UserHealthRecord;
import com.example.demo.repository.UserHealthRepository;
import com.example.demo.repository.UserRepository;
import com.example.demo.service.UserHealthService;
import lombok.RequiredArgsConstructor;

import java.time.LocalDateTime;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import com.example.demo.repository.UserHealthRecordRepository; 
import java.util.List;
import com.example.demo.dto.InsightsResponse;

@RestController
@RequestMapping("/api/vitals")
@RequiredArgsConstructor
public class UserHealthController {

    private final UserHealthService userHealthService;
    private final UserRepository userRepository;
    private final UserHealthRepository userHealthRepository;
    private final UserHealthRecordRepository userHealthRecordRepository; 

    @PostMapping
    public ResponseEntity<String> addVitalMeasurement(@RequestBody CreateHealthRecordRequest req) {
        userHealthService.saveHealthRecord(req);
        return ResponseEntity.ok("Measurement saved and average updated.");
    }

    @GetMapping("/summary")
    @Transactional(readOnly = true)
    public ResponseEntity<UserHealthResponse> getUserHealthSummary(@RequestParam String userId) {

        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        UserHealth userHealth = userHealthRepository.findByUser(user).orElse(null);

        // ✅ 옵션 A: 최신 record 1건 조회
        UserHealthRecord latest = userHealthRecordRepository
                .findTopByUser_IdOrderByMeasuredAtDesc(user.getId())
                .orElse(null);

        // 둘 다 없으면 204 권장 (원하면 ok(null) 유지해도 됨)
        if (userHealth == null && latest == null) {
            return ResponseEntity.noContent().build();
        }

        // ✅ DTO가 (UserHealth, latestRecord) 받도록 변경
        UserHealthResponse response = new UserHealthResponse(userHealth, latest);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/insights")
    @Transactional(readOnly = true)
    public ResponseEntity<InsightsResponse> getInsights(
            @RequestParam String userId,
            @RequestParam(defaultValue = "7d") String range
    ) {
        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        int days = switch (range) {
            case "30d" -> 30;
            case "365d" -> 365;
            default -> 7;
        };

        LocalDateTime end = LocalDateTime.now();
        LocalDateTime start = end.minusDays(days - 1);

        List<UserHealthRecord> rows =
                userHealthRecordRepository.findByUser_IdAndMeasuredAtBetweenOrderByMeasuredAtAsc(
                        user.getId(), start, end
                );

        // ✅ 날짜별로 점수 계산해서 7/30/365 길이로 채워서 내려주기
        // (점수 계산 규칙은 아래에서 설명)
        InsightsResponse resp = InsightsResponse.from(rows, days);
        return ResponseEntity.ok(resp);
    }

}