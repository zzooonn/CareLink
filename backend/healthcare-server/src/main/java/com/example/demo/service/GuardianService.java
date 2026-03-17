package com.example.demo.service;

import com.example.demo.dto.ConnectedPatientResponseDto;
import com.example.demo.entity.User;
import com.example.demo.entity.UserGuardianLink;
import com.example.demo.entity.UserRole;
import com.example.demo.repository.UserGuardianLinkRepository;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GuardianService {

    private final UserRepository userRepository;
    private final UserGuardianLinkRepository userGuardianLinkRepository;

    /**
     * 환자-보호자 연결하기
     * @param contactPhone 환자가 저장하는 보호자 연락처 (null이면 보호자 계정의 phone 사용)
     */
    @Transactional
    public void connectGuardian(String patientId, String guardianId, String contactPhone) {

        User patient = userRepository.findByUserId(patientId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Patient not found"));

        User guardian = userRepository.findByUserId(guardianId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Guardian not found"));

        if (guardian.getRole() != UserRole.GUARDIAN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The user is not a guardian account");
        }

        if (userGuardianLinkRepository.existsByPatientAndGuardian(patient, guardian)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already connected");
        }

        UserGuardianLink link = new UserGuardianLink();
        link.setPatient(patient);
        link.setGuardian(guardian);
        link.setRelationType("FAMILY");
        // contactPhone 미전송 시 보호자 계정의 등록 전화번호를 기본값으로 사용
        link.setContactPhone(contactPhone != null && !contactPhone.isBlank()
                ? contactPhone
                : guardian.getPhone());

        userGuardianLinkRepository.save(link);
    }

    /**
     * 환자-보호자 연결 해제
     */
    @Transactional
    public void disconnectGuardian(String patientId, String guardianId) {
        User patient = userRepository.findByUserId(patientId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Patient not found"));
        User guardian = userRepository.findByUserId(guardianId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Guardian not found"));

        if (!userGuardianLinkRepository.existsByPatientAndGuardian(patient, guardian)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Connection not found");
        }

        userGuardianLinkRepository.deleteByPatientAndGuardian(patient, guardian);
    }

    /**
     * 보호자가 관리하는 환자 목록 조회
     */
    @Transactional(readOnly = true)
    public List<ConnectedPatientResponseDto> getMyPatients(String guardianId) {
        User guardian = userRepository.findByUserId(guardianId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Guardian not found"));

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
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Patient not found"));

        List<UserGuardianLink> links = userGuardianLinkRepository.findByPatient(patient);

        return links.stream()
                .map(link -> ConnectedPatientResponseDto.fromEntity(link.getGuardian(), link.getContactPhone()))
                .collect(Collectors.toList());
    }

}
