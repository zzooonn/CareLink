package com.example.demo.service;

import com.example.demo.dto.ConnectedPatientResponseDto;
import com.example.demo.entity.User;
import com.example.demo.entity.UserGuardianLink;
import com.example.demo.entity.UserRole;
import com.example.demo.repository.UserGuardianLinkRepository;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GuardianService {

    private final UserRepository userRepository;
    private final UserGuardianLinkRepository userGuardianLinkRepository;

    /**
     * 환자-보호자 연결하기
     */
    @Transactional
    public void connectGuardian(String patientId, String guardianId) {

        User patient = userRepository.findByUserId(patientId)
                .orElseThrow(() -> new IllegalArgumentException("환자를 찾을 수 없습니다."));

        User guardian = userRepository.findByUserId(guardianId)
                .orElseThrow(() -> new IllegalArgumentException("보호자를 찾을 수 없습니다."));

        if (guardian.getRole() != UserRole.GUARDIAN) {
            throw new IllegalArgumentException("해당 유저는 보호자 계정이 아닙니다.");
        }

        if (userGuardianLinkRepository.existsByPatientAndGuardian(patient, guardian)) {
            throw new IllegalArgumentException("이미 연결된 보호자입니다.");
        }

        UserGuardianLink link = new UserGuardianLink();
        link.setPatient(patient);
        link.setGuardian(guardian);
        link.setRelationType("FAMILY");

        userGuardianLinkRepository.save(link);
    }

    /**
     * 보호자가 관리하는 환자 목록 조회
     */
    @Transactional(readOnly = true)
    public List<ConnectedPatientResponseDto> getMyPatients(String guardianId) {
        User guardian = userRepository.findByUserId(guardianId)
                .orElseThrow(() -> new IllegalArgumentException("보호자를 찾을 수 없습니다."));

        List<UserGuardianLink> links = userGuardianLinkRepository.findByGuardian(guardian);

        return links.stream()
                .map(link -> ConnectedPatientResponseDto.fromEntity(link.getPatient()))
                .collect(Collectors.toList());
    }

    /**
     * ✅ 환자가 연결된 보호자 목록 조회
     */
    @Transactional(readOnly = true)
    public List<ConnectedPatientResponseDto> getMyGuardians(String patientId) {
        User patient = userRepository.findByUserId(patientId)
                .orElseThrow(() -> new IllegalArgumentException("환자를 찾을 수 없습니다."));

        List<UserGuardianLink> links = userGuardianLinkRepository.findByPatient(patient);

        return links.stream()
                .map(link -> ConnectedPatientResponseDto.fromEntity(link.getGuardian()))
                .collect(Collectors.toList());
    }

}
