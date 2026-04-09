package com.example.demo.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.*;

@DisplayName("LoginAttemptService 단위 테스트 (Rate Limiting)")
class LoginAttemptServiceTest {

    private LoginAttemptService service;

    @BeforeEach
    void setUp() {
        service = new LoginAttemptService();
    }

    @Test
    @DisplayName("초기 상태 - 차단 없음")
    void checkBlocked_noAttempts_notBlocked() {
        assertThatCode(() -> service.checkBlocked("user1"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("5회 실패 후 6번째 시도 - 429 Too Many Requests")
    void checkBlocked_after5Failures_blocks() {
        for (int i = 0; i < 5; i++) {
            service.recordFailure("user1");
        }

        assertThatThrownBy(() -> service.checkBlocked("user1"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    @DisplayName("4회 실패 - 아직 차단되지 않음")
    void checkBlocked_4failures_notBlockedYet() {
        for (int i = 0; i < 4; i++) {
            service.recordFailure("user1");
        }

        assertThatCode(() -> service.checkBlocked("user1"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("로그인 성공 후 기록 초기화 - 이후 시도 허용")
    void recordSuccess_clearsAttempts() {
        for (int i = 0; i < 5; i++) {
            service.recordFailure("user1");
        }
        service.recordSuccess("user1");

        // 성공 후 차단 해제
        assertThatCode(() -> service.checkBlocked("user1"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("다른 사용자 - 독립적으로 관리됨")
    void differentUsers_independentlyTracked() {
        for (int i = 0; i < 5; i++) {
            service.recordFailure("user1");
        }

        // user2는 실패 없으므로 차단 안 됨
        assertThatCode(() -> service.checkBlocked("user2"))
                .doesNotThrowAnyException();

        // user1은 차단됨
        assertThatThrownBy(() -> service.checkBlocked("user1"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }
}
