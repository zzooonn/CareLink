package com.example.demo.service;

import com.example.demo.entity.User;
import com.example.demo.entity.UserGuardianLink;
import com.example.demo.entity.UserHealthAlert;
import com.example.demo.entity.UserRole;
import com.example.demo.push.AlertCreatedEvent;
import com.example.demo.repository.UserGuardianLinkRepository;
import com.example.demo.repository.UserHealthAlertRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock UserHealthAlertRepository alertRepository;
    @Mock UserGuardianLinkRepository guardianLinkRepository;
    @Mock ApplicationEventPublisher eventPublisher;
    @InjectMocks NotificationService notificationService;

    @Test
    void 환자와_연결된_보호자마다_알림을_저장하고_푸시_이벤트를_발행한다() {
        User patient = user("patientA", UserRole.PATIENT, "ExponentPushToken[patient]");
        User guardianB = user("guardianB", UserRole.GUARDIAN, "ExponentPushToken[guardianB]");
        User guardianC = user("guardianC", UserRole.GUARDIAN, null); // 토큰 없는 보호자

        given(guardianLinkRepository.findByPatient(patient))
                .willReturn(List.of(link(patient, guardianB), link(patient, guardianC)));
        AtomicLong ids = new AtomicLong(1);
        given(alertRepository.save(any(UserHealthAlert.class))).willAnswer(inv -> {
            UserHealthAlert a = inv.getArgument(0);
            a.setId(ids.getAndIncrement());
            return a;
        });

        notificationService.sendEmergencyAlert(patient, "혈압 이상", "150/95", "HIGH_BP");

        verify(alertRepository, times(3)).save(any(UserHealthAlert.class));
        ArgumentCaptor<AlertCreatedEvent> events = ArgumentCaptor.forClass(AlertCreatedEvent.class);
        verify(eventPublisher, times(3)).publishEvent(events.capture());

        assertThat(events.getAllValues())
                .extracting(AlertCreatedEvent::receiverPushToken)
                .containsExactly("ExponentPushToken[patient]", "ExponentPushToken[guardianB]", null);
        assertThat(events.getAllValues())
                .extracting(AlertCreatedEvent::alertId)
                .containsExactly(1L, 2L, 3L);
    }

    private static User user(String userId, UserRole role, String token) {
        User u = new User();
        u.setUserId(userId);
        u.setName(userId);
        u.setRole(role);
        u.setExpoPushToken(token);
        return u;
    }

    private static UserGuardianLink link(User patient, User guardian) {
        UserGuardianLink l = new UserGuardianLink();
        l.setPatient(patient);
        l.setGuardian(guardian);
        return l;
    }
}
