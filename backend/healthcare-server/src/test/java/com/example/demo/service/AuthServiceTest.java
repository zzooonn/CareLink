package com.example.demo.service;

import com.example.demo.dto.auth.LoginRequest;
import com.example.demo.dto.auth.LoginResponse;
import com.example.demo.dto.auth.RegisterRequest;
import com.example.demo.entity.User;
import com.example.demo.entity.UserRole;
import com.example.demo.jwt.JwtProvider;
import com.example.demo.repository.UserGuardianLinkRepository;
import com.example.demo.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthService 단위 테스트")
class AuthServiceTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtProvider jwtProvider;
    @Mock UserGuardianLinkRepository userGuardianLinkRepository;
    @Mock PasswordResetTokenService passwordResetTokenService;

    @InjectMocks AuthService authService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setUserId("patient001");
        testUser.setPassword("hashed_pw");
        testUser.setRole(UserRole.PATIENT);
        testUser.setName("테스트 환자");
        testUser.setBirthDate(LocalDate.of(1960, 1, 1));
        testUser.setPhone("01012345678");
    }

    // ──────────────────────────────────────────────────────────────────────
    // login() 테스트
    // ──────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("정상 로그인 - JWT 토큰 반환")
    void login_success() {
        given(userRepository.findByUserId("patient001")).willReturn(Optional.of(testUser));
        given(passwordEncoder.matches("plain_pw", "hashed_pw")).willReturn(true);
        given(jwtProvider.createToken("patient001", UserRole.PATIENT)).willReturn("access_token");
        given(jwtProvider.createRefreshToken("patient001")).willReturn("refresh_token");

        LoginRequest req = new LoginRequest();
        req.setUserId("patient001");
        req.setPassword("plain_pw");

        LoginResponse response = authService.login(req);

        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getToken()).isEqualTo("access_token");
        assertThat(response.getRefreshToken()).isEqualTo("refresh_token");
    }

    @Test
    @DisplayName("존재하지 않는 사용자 로그인 - 401 반환")
    void login_userNotFound_returns401() {
        given(userRepository.findByUserId("unknown")).willReturn(Optional.empty());

        LoginRequest req = new LoginRequest();
        req.setUserId("unknown");
        req.setPassword("any");

        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("비밀번호 불일치 로그인 - 401 반환")
    void login_wrongPassword_returns401() {
        given(userRepository.findByUserId("patient001")).willReturn(Optional.of(testUser));
        given(passwordEncoder.matches("wrong_pw", "hashed_pw")).willReturn(false);

        LoginRequest req = new LoginRequest();
        req.setUserId("patient001");
        req.setPassword("wrong_pw");

        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // ──────────────────────────────────────────────────────────────────────
    // register() 테스트
    // ──────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("정상 회원가입 - User 엔티티 저장")
    void register_success() {
        given(userRepository.findByUserId("newuser")).willReturn(Optional.empty());
        given(passwordEncoder.encode("pass1234")).willReturn("hashed_pass");
        given(userRepository.save(any(User.class))).willAnswer(inv -> inv.getArgument(0));

        RegisterRequest req = new RegisterRequest();
        req.setUserId("newuser");
        req.setPassword("pass1234");
        req.setName("신규 사용자");
        req.setBirthDate(LocalDate.of(1970, 5, 10));
        req.setPhone("01099998888");
        req.setRole(UserRole.PATIENT);

        User saved = authService.register(req);

        assertThat(saved.getUserId()).isEqualTo("newuser");
        assertThat(saved.getPassword()).isEqualTo("hashed_pass");
        then(userRepository).should().save(any(User.class));
    }

    @Test
    @DisplayName("중복 userId 회원가입 - 409 Conflict 반환")
    void register_duplicateUserId_returns409() {
        given(userRepository.findByUserId("patient001")).willReturn(Optional.of(testUser));

        RegisterRequest req = new RegisterRequest();
        req.setUserId("patient001");
        req.setPassword("pass1234");
        req.setName("중복");
        req.setBirthDate(LocalDate.of(1970, 1, 1));
        req.setPhone("01000000000");
        req.setRole(UserRole.PATIENT);

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    @DisplayName("빈 userId 회원가입 - 400 Bad Request 반환")
    void register_emptyUserId_returns400() {
        RegisterRequest req = new RegisterRequest();
        req.setUserId("  ");  // 공백만 있는 경우
        req.setPassword("pass1234");
        req.setBirthDate(LocalDate.of(1970, 1, 1));

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
