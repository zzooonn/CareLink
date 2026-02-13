package com.example.demo.controller;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.dto.AlertRequestDto;
import com.example.demo.entity.User;
import com.example.demo.repository.UserRepository;
import com.example.demo.service.NotificationService;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;


@RestController
@RequestMapping("/api/notification")
@RequiredArgsConstructor
public class NotificationController {
    
    private final NotificationService notificationService;
    private final UserRepository userRepository;


    @PostMapping("/send")
    public ResponseEntity<String> sendAlert(@RequestBody AlertRequestDto request) {
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
}
