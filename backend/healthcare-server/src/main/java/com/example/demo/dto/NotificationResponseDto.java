package com.example.demo.dto;

import java.time.LocalDateTime;

public record NotificationResponseDto(
        Long id,
        String title,
        String message,
        String alertType,
        String patientUserId,
        LocalDateTime createdAt,
        boolean read
) {
}
