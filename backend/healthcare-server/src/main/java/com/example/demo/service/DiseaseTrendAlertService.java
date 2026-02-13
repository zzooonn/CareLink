package com.example.demo.service;

import com.example.demo.entity.DiseaseTrend;
import com.example.demo.entity.User;
import com.example.demo.entity.UserDisease;
import com.example.demo.entity.UserRole;
import com.example.demo.repository.DiseaseTrendRepository;
import com.example.demo.repository.UserDiseaseRepository;
import com.example.demo.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DiseaseTrendAlertService {

    private final DiseaseTrendRepository diseaseTrendRepository;
    private final UserRepository userRepository;
    private final UserDiseaseRepository userDiseaseRepository;

    // ✅ 기존 알림 서비스 재사용
    private final NotificationService notificationService;

    @Transactional
    public void generateDiseaseTrendAlerts() {

        // 1) HIGH 트렌드만 가져오기 (원하면 MEDIUM도 추가 가능)
        List<DiseaseTrend> trends = diseaseTrendRepository.findByRiskLevel("HIGH");

        if (trends.isEmpty()) {
            log.info("[DiseaseTrendAlertService] No HIGH disease trends found.");
            return;
        }

        for (DiseaseTrend trend : trends) {
            List<User> targets = findEligiblePatients(trend);

            if (targets.isEmpty()) {
                log.info("[DiseaseTrendAlertService] No targets for trend id={}", trend.getId());
                continue;
            }

            String title = "[질병 트렌드] " + trend.getDiseaseName();
            String message = trend.getAdvisoryText();

            for (User patient : targets) {
                // ✅ 기존 NotificationService 메서드 그대로 재사용
                // 환자 + 보호자에게 UserHealthAlert 저장 + 실시간 푸시까지 처리됨
                notificationService.sendEmergencyAlert(
                        patient,
                        title,
                        message,
                        "DISEASE_TREND"
                );
            }
        }
    }

    /**
     * 지금 UserRepository에는 나이/지역 조회 메서드가 없으므로
     * 우선은 "환자(role) + 질병코드(targetGroup)" 기준으로만 대상자 선정.
     */
    private List<User> findEligiblePatients(DiseaseTrend trend) {

        // 0) 환자 role만 후보로 가져오기 (UserRole 값은 프로젝트에 맞게 바꿔야 할 수 있음)
        // 예: PATIENT가 아니라 USER일 수도 있음
        List<User> candidates = userRepository.findByRole(UserRole.PATIENT);

        // 1) targetGroup이 없거나 ALL이면 -> 전체 후보 반환
        String targetGroup = trend.getTargetGroup();
        if (targetGroup == null || targetGroup.isBlank() || "ALL".equalsIgnoreCase(targetGroup)) {
            return candidates;
        }

        // 2) targetGroup을 "질병코드"로 사용 (예: DM, HTN)
        List<UserDisease> diseases = userDiseaseRepository.findByDiseaseCode(targetGroup);

        Set<Long> targetUserPkSet = diseases.stream()
                .map(d -> d.getUser().getId())   // ✅ PK(Long)
                .collect(Collectors.toSet());

        // 3) 후보군 중에서 질병코드 가진 사람만 남김
        return candidates.stream()
                .filter(u -> targetUserPkSet.contains(u.getId()))
                .toList();
    }
}
