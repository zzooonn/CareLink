package com.example.demo.controller;

import com.example.demo.dto.auth.LoginRequest;
import com.example.demo.dto.auth.LoginResponse;
import com.example.demo.dto.auth.RegisterRequest;
import com.example.demo.entity.User;
import com.example.demo.security.LoginAttemptService;
import com.example.demo.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @Autowired
    private AuthService authService;

    @Autowired
    private LoginAttemptService loginAttemptService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        String key = "login:" + request.getUserId();
        // 15분 내 5회 초과 실패 시 429 반환
        loginAttemptService.checkBlocked(key);
        try {
            LoginResponse response = authService.login(request);
            loginAttemptService.recordSuccess(key);
            return ResponseEntity.ok()
                    .header("Content-Type", "application/json;charset=UTF-8")
                    .body(response);
        } catch (Exception e) {
            loginAttemptService.recordFailure(key);
            throw e;
        }
    }

    @PostMapping("/signup")
    public ResponseEntity<Map<String, Object>> register(@Valid @RequestBody RegisterRequest request) {
        User saved = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(
                Map.of(
                        "success", true,
                        "message", "signup successful",
                        "userId", saved.getUserId()
                )
        );
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, Object>> forgotPassword(@RequestBody Map<String, String> body) {
        String userId = body.get("userId");
        String key = "forgot:" + userId;
        // 비밀번호 재설정도 동일한 Rate Limit 적용
        loginAttemptService.checkBlocked(key);
        try {
            String resetToken = authService.verifyIdentity(userId, body.get("birthDate"));
            loginAttemptService.recordSuccess(key);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Identity verified",
                    "resetToken", resetToken
            ));
        } catch (Exception e) {
            loginAttemptService.recordFailure(key);
            throw e;
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(@RequestBody Map<String, String> body) {
        authService.resetPassword(body.get("userId"), body.get("newPassword"), body.get("resetToken"));
        return ResponseEntity.ok(Map.of("success", true, "message", "Password reset successfully"));
    }

    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(@RequestBody Map<String, String> body) {
        LoginResponse response = authService.refreshToken(body.get("refreshToken"));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/find-id")
    public ResponseEntity<Map<String, Object>> findId(@RequestBody Map<String, String> body) {
        String userId = authService.findUserId(body.get("name"), body.get("birthDate"), body.get("phone"));
        return ResponseEntity.ok(Map.of("success", true, "userId", userId));
    }
}
