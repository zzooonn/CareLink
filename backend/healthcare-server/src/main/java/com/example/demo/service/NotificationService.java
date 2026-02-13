package com.example.demo.service;

import com.example.demo.entity.User;
import com.example.demo.entity.UserGuardianLink;
import com.example.demo.entity.UserHealthAlert;
import com.example.demo.repository.UserGuardianLinkRepository;
import com.example.demo.repository.UserHealthAlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final UserHealthAlertRepository alertRepository;
    private final UserGuardianLinkRepository guardianLinkRepository;

    @Transactional
    public void sendEmergencyAlert(User patient, String title, String message, String alertType) {
        
        createAndSaveAlert(patient, patient, title, message, alertType);

        List<UserGuardianLink> guardianLinks = guardianLinkRepository.findByPatient(patient);

        for (UserGuardianLink link : guardianLinks) {
            User guardian = link.getGuardian();
            createAndSaveAlert(patient, guardian, title, message, alertType);
        }
    }

    /**
     * 내부적으로 사용하는 알림 생성 헬퍼 메서드
     * @param patient 아픈 사람 (주체)
     * @param receiver 알림 받는 사람 (대상) - 환자 본인일 수도 있고 보호자일 수도 있음
     */
    private void createAndSaveAlert(User patient, User receiver, String title, String message, String alertType) {
        
        // 엔티티 생성 (Setter 방식 사용)
        UserHealthAlert alert = new UserHealthAlert();
        alert.setPatient(patient);   // 누구 때문에 알림이 떴나?
        alert.setReceiver(receiver); // 누가 이 알림을 보나?
        alert.setTitle(title);
        alert.setMessage(message);
        alert.setAlertType(alertType);

        // DB 저장
        alertRepository.save(alert);

        sendRealTimePush(receiver, title, message);
    }

    private void sendRealTimePush(User receiver, String title, String message) {
        System.out.println(">>> [알림 전송] To: " + receiver.getName() + " (" + receiver.getRole() + ")");
        System.out.println("    제목: " + title);
        System.out.println("    내용: " + message);
    }
}