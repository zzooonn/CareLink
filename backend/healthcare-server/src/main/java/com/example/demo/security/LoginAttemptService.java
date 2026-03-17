package com.example.demo.security;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 인증 엔드포인트 브루트포스 방어용 Rate Limiter
 * - 15분 윈도우 내 최대 5회 실패 시 15분간 차단
 * - key: userId (login/forgot-password 공통)
 * - 외부 라이브러리 없이 ConcurrentHashMap으로 구현 (단일 인스턴스 환경)
 */
@Service
public class LoginAttemptService {

    private static final int    MAX_ATTEMPTS    = 5;
    private static final long   WINDOW_MS       = 15 * 60 * 1000L; // 15분

    private record AttemptRecord(int count, long windowStart) {}

    private final ConcurrentHashMap<String, AttemptRecord> attempts = new ConcurrentHashMap<>();

    /**
     * 차단 여부 확인. 차단된 경우 429 예외를 던진다.
     */
    public void checkBlocked(String key) {
        AttemptRecord rec = attempts.get(key);
        if (rec == null) return;

        long now = Instant.now().toEpochMilli();
        // 윈도우 만료 시 초기화
        if (now - rec.windowStart() >= WINDOW_MS) {
            attempts.remove(key);
            return;
        }
        if (rec.count() >= MAX_ATTEMPTS) {
            long remainSec = (WINDOW_MS - (now - rec.windowStart())) / 1000;
            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Too many attempts. Try again in " + remainSec + " seconds."
            );
        }
    }

    /**
     * 실패 횟수 증가
     */
    public void recordFailure(String key) {
        long now = Instant.now().toEpochMilli();
        attempts.compute(key, (k, rec) -> {
            if (rec == null || now - rec.windowStart() >= WINDOW_MS) {
                return new AttemptRecord(1, now);
            }
            return new AttemptRecord(rec.count() + 1, rec.windowStart());
        });
    }

    /**
     * 성공 시 기록 초기화
     */
    public void recordSuccess(String key) {
        attempts.remove(key);
    }
}
