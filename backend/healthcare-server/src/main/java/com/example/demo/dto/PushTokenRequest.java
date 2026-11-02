package com.example.demo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 앱이 발급받은 Expo 푸시 토큰 (예: ExponentPushToken[xxxxxxxx]) */
public record PushTokenRequest(
        @NotBlank @Size(max = 255) String token
) {}
