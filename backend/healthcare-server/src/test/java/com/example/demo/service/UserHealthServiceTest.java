package com.example.demo.service;

import com.example.demo.dto.CreateHealthRecordRequest;
import com.example.demo.entity.User;
import com.example.demo.entity.UserHealth;
import com.example.demo.entity.UserHealthRecord;
import com.example.demo.entity.UserRole;
import com.example.demo.repository.UserHealthRecordRepository;
import com.example.demo.repository.UserHealthRepository;
import com.example.demo.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserHealthService 단위 테스트")
class UserHealthServiceTest {

    @Mock UserRepository userRepository;
    @Mock UserHealthRepository userHealthRepository;
    @Mock UserHealthRecordRepository userHealthRecordRepository;
    @Mock NotificationService notificationService;

    @InjectMocks UserHealthService userHealthService;

    private User testUser;
    private UserHealth userHealth;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setUserId("patient001");
        testUser.setRole(UserRole.PATIENT);

        userHealth = new UserHealth();
        userHealth.setUser(testUser);
        userHealth.setAvgBpSys(120);
        userHealth.setAvgBpDia(80);
        userHealth.setAvgGlucose(100);
    }

    // ──────────────────────────────────────────────────────────────────────
    // 혈압 이상 감지 테스트
    // ──────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("고혈압 기준 초과(SBP≥140) - 이상 플래그 설정 및 알림 트리거")
    void saveHealthRecord_hypertension_setsAbnormalAndNotifies() {
        given(userRepository.findByUserId("patient001")).willReturn(Optional.of(testUser));
        given(userHealthRepository.findByUser(testUser)).willReturn(Optional.of(userHealth));
        given(userHealthRecordRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

        CreateHealthRecordRequest req = new CreateHealthRecordRequest();
        req.setUserId("patient001");
        req.setBpSys(145);   // 고혈압 기준(140) 초과
        req.setBpDia(92);

        userHealthService.saveHealthRecord(req);

        ArgumentCaptor<UserHealthRecord> captor = ArgumentCaptor.forClass(UserHealthRecord.class);
        then(userHealthRecordRepository).should().save(captor.capture());
        UserHealthRecord saved = captor.getValue();

        assertThat(saved.getBpAbnormal()).isTrue();
        assertThat(saved.getAnomalyDetails()).contains("HIGH_BP");
    }

    @Test
    @DisplayName("정상 혈압 - 이상 플래그 미설정")
    void saveHealthRecord_normalBP_noAbnormalFlag() {
        given(userRepository.findByUserId("patient001")).willReturn(Optional.of(testUser));
        given(userHealthRepository.findByUser(testUser)).willReturn(Optional.of(userHealth));
        given(userHealthRecordRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

        CreateHealthRecordRequest req = new CreateHealthRecordRequest();
        req.setUserId("patient001");
        req.setBpSys(118);
        req.setBpDia(78);

        userHealthService.saveHealthRecord(req);

        ArgumentCaptor<UserHealthRecord> captor = ArgumentCaptor.forClass(UserHealthRecord.class);
        then(userHealthRecordRepository).should().save(captor.capture());
        assertThat(captor.getValue().getBpAbnormal()).isFalse();
    }

    @Test
    @DisplayName("저혈압 기준 미만(SBP<90) - 이상 플래그 및 LOW_BP 알림")
    void saveHealthRecord_hypotension_setsAbnormal() {
        given(userRepository.findByUserId("patient001")).willReturn(Optional.of(testUser));
        given(userHealthRepository.findByUser(testUser)).willReturn(Optional.of(userHealth));
        given(userHealthRecordRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

        CreateHealthRecordRequest req = new CreateHealthRecordRequest();
        req.setUserId("patient001");
        req.setBpSys(85);
        req.setBpDia(55);

        userHealthService.saveHealthRecord(req);

        ArgumentCaptor<UserHealthRecord> captor = ArgumentCaptor.forClass(UserHealthRecord.class);
        then(userHealthRecordRepository).should().save(captor.capture());
        assertThat(captor.getValue().getBpAbnormal()).isTrue();
        assertThat(captor.getValue().getAnomalyDetails()).contains("LOW_BP");
    }

    // ──────────────────────────────────────────────────────────────────────
    // 혈당 이상 감지 테스트
    // ──────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("고혈당(≥200) - 이상 플래그 설정")
    void saveHealthRecord_highGlucose_setsAbnormal() {
        given(userRepository.findByUserId("patient001")).willReturn(Optional.of(testUser));
        given(userHealthRepository.findByUser(testUser)).willReturn(Optional.of(userHealth));
        given(userHealthRecordRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

        CreateHealthRecordRequest req = new CreateHealthRecordRequest();
        req.setUserId("patient001");
        req.setGlucose(220);

        userHealthService.saveHealthRecord(req);

        ArgumentCaptor<UserHealthRecord> captor = ArgumentCaptor.forClass(UserHealthRecord.class);
        then(userHealthRecordRepository).should().save(captor.capture());
        assertThat(captor.getValue().getGlucoseAbnormal()).isTrue();
        assertThat(captor.getValue().getAnomalyDetails()).contains("HIGH_GLUCOSE");
    }

    @Test
    @DisplayName("저혈당(≤70) - 이상 플래그 설정")
    void saveHealthRecord_lowGlucose_setsAbnormal() {
        given(userRepository.findByUserId("patient001")).willReturn(Optional.of(testUser));
        given(userHealthRepository.findByUser(testUser)).willReturn(Optional.of(userHealth));
        given(userHealthRecordRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

        CreateHealthRecordRequest req = new CreateHealthRecordRequest();
        req.setUserId("patient001");
        req.setGlucose(65);

        userHealthService.saveHealthRecord(req);

        ArgumentCaptor<UserHealthRecord> captor = ArgumentCaptor.forClass(UserHealthRecord.class);
        then(userHealthRecordRepository).should().save(captor.capture());
        assertThat(captor.getValue().getGlucoseAbnormal()).isTrue();
        assertThat(captor.getValue().getAnomalyDetails()).contains("LOW_GLUCOSE");
    }

    @Test
    @DisplayName("존재하지 않는 사용자 - RuntimeException 발생")
    void saveHealthRecord_userNotFound_throwsException() {
        given(userRepository.findByUserId("nobody")).willReturn(Optional.empty());

        CreateHealthRecordRequest req = new CreateHealthRecordRequest();
        req.setUserId("nobody");
        req.setBpSys(120);
        req.setBpDia(80);

        assertThatThrownBy(() -> userHealthService.saveHealthRecord(req))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("User not found");
    }
}
