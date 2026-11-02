package com.example.demo.service;

import com.example.demo.entity.User;
import com.example.demo.entity.UserGuardianLink;
import com.example.demo.entity.UserHealthAlert;
import com.example.demo.push.AlertCreatedEvent;
import com.example.demo.repository.UserGuardianLinkRepository;
import com.example.demo.repository.UserHealthAlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final UserHealthAlertRepository alertRepository;
    private final UserGuardianLinkRepository guardianLinkRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendEmergencyAlert(User patient, String title, String message, String alertType) {
        createAndSaveAlert(patient, patient, title, message, alertType);

        List<UserGuardianLink> guardianLinks = guardianLinkRepository.findByPatient(patient);
        for (UserGuardianLink link : guardianLinks) {
            User guardian = link.getGuardian();
            createAndSaveAlert(patient, guardian, title, message, alertType);
        }
    }

    private void createAndSaveAlert(User patient, User receiver, String title, String message, String alertType) {
        UserHealthAlert alert = new UserHealthAlert();
        alert.setPatient(patient);
        alert.setReceiver(receiver);
        alert.setTitle(title);
        alert.setMessage(message);
        alert.setAlertType(alertType);

        UserHealthAlert saved = alertRepository.save(alert);
        log.info("Alert saved for {} ({}) - {}", receiver.getUserId(), receiver.getRole(), title);

        // 실제 푸시는 PushNotificationListener가 트랜잭션 커밋 후 비동기로 보낸다.
        eventPublisher.publishEvent(new AlertCreatedEvent(
                saved.getId(),
                receiver.getExpoPushToken(),
                alertType,
                title,
                message));
    }
}
