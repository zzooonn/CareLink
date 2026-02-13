package com.example.demo.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.demo.dto.CreateUserDiseaseRequest;
import com.example.demo.dto.UserDiseaseResponse;
import com.example.demo.entity.User;
import com.example.demo.entity.UserDisease;
import com.example.demo.repository.UserDiseaseRepository;
import com.example.demo.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserDiseaseService {

    private final UserRepository userRepository;
    private final UserDiseaseRepository userDiseaseRepository;

    @Transactional
    public UserDiseaseResponse addDisease(String userId, CreateUserDiseaseRequest req) {
        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("user not found"));

        UserDisease disease = new UserDisease();
        disease.setUser(user);
        disease.setDiseaseName(req.getDiseaseName());
        disease.setDiseaseCode(req.getDiseaseCode());
        disease.setDiagnosedAt(req.getDiagnosedAt());

        UserDisease saved = userDiseaseRepository.save(disease);
        return UserDiseaseResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<UserDiseaseResponse> getMyDiseases(String userId) {
        return userDiseaseRepository.findByUserUserId(userId).stream()  // ✅ findByUserUserId 사용
                .map(UserDiseaseResponse::from)
                .toList();
    }
}
