package com.example.demo.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PasswordResetTokenService {

    private final Map<String, ResetTokenRecord> tokens = new ConcurrentHashMap<>();
    private final Duration ttl;

    public PasswordResetTokenService(@Value("${password-reset.token-expiration-ms:600000}") long expirationMs) {
        this.ttl = Duration.ofMillis(expirationMs);
    }

    public String issueToken(String userId) {
        String token = UUID.randomUUID().toString();
        tokens.put(userId, new ResetTokenRecord(token, Instant.now().plus(ttl)));
        return token;
    }

    public void validateToken(String userId, String token) {
        ResetTokenRecord record = tokens.get(userId);
        if (record == null || !record.token().equals(token) || Instant.now().isAfter(record.expiresAt())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired reset token");
        }
    }

    public void consumeToken(String userId) {
        tokens.remove(userId);
    }

    @Scheduled(fixedRateString = "${password-reset.cleanup-interval-ms:300000}")
    public void cleanupExpiredTokens() {
        Instant now = Instant.now();
        tokens.entrySet().removeIf(e -> now.isAfter(e.getValue().expiresAt()));
    }

    private record ResetTokenRecord(String token, Instant expiresAt) {
    }
}
