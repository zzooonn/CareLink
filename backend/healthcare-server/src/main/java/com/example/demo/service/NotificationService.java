package com.example.demo.service;

import com.example.demo.entity.User;
import com.example.demo.entity.UserGuardianLink;
import com.example.demo.entity.UserHealthAlert;
import com.example.demo.repository.UserGuardianLinkRepository;
import com.example.demo.repository.UserHealthAlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

        alertRepository.save(alert);
        sendRealTimePush(receiver, title, message);
    }

    private void sendRealTimePush(User receiver, String title, String message) {
        log.info("Sending alert to {} ({}) - {}", receiver.getName(), receiver.getRole(), title);
        log.debug("Alert message: {}", message);
    }
}
