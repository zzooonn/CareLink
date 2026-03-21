package com.example.demo.controller;

import com.example.demo.dto.AlertRequestDto;
import com.example.demo.dto.NotificationResponseDto;
import com.example.demo.entity.User;
import com.example.demo.entity.UserHealthAlert;
import com.example.demo.repository.UserHealthAlertRepository;
import com.example.demo.repository.UserRepository;
import com.example.demo.security.AccessControlService;
import com.example.demo.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/notification")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final UserHealthAlertRepository alertRepository;
    private final AccessControlService accessControlService;

    @PostMapping("/send")
    public ResponseEntity<String> sendAlert(@RequestBody AlertRequestDto request) {
        accessControlService.ensureSelfOrLinkedGuardian(request.getUserId());
        User patient = userRepository.findByUserId(request.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("Patient not found"));

        notificationService.sendEmergencyAlert(
                patient,
                request.getTitle(),
                request.getMessage(),
                request.getAlertType()
        );

        return ResponseEntity.ok("Alert sent successfully");
    }

    @GetMapping("/{userId}")
    @Transactional(readOnly = true)
    public ResponseEntity<List<NotificationResponseDto>> getAlerts(@PathVariable String userId) {
        accessControlService.ensureSelfOrLinkedGuardian(userId);
        User receiver = userRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        List<NotificationResponseDto> result = alertRepository.findNotificationResponsesByReceiver(receiver);

        return ResponseEntity.ok(result);
    }

    @PatchMapping("/{userId}/{alertId}/read")
    public ResponseEntity<Void> markRead(@PathVariable String userId, @PathVariable Long alertId) {
        accessControlService.ensureSelf(userId);
        User receiver = userRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        UserHealthAlert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert not found"));

        if (!alert.getReceiver().getId().equals(receiver.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your alert");
        }

        if (alert.getReadAt() == null) {
            alert.setReadAt(LocalDateTime.now());
            alertRepository.save(alert);
        }

        return ResponseEntity.noContent().build();
    }
}
