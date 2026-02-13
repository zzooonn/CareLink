package com.example.demo.controller;

import java.util.List;

import org.springframework.web.bind.annotation.*;

import com.example.demo.dto.CreateUserDiseaseRequest;
import com.example.demo.dto.UserDiseaseResponse;
import com.example.demo.service.UserDiseaseService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/user-diseases")
@RequiredArgsConstructor
public class UserDiseaseController {

    private final UserDiseaseService userDiseaseService;

    // ✔ 로그인 객체 필요 없이 요청 JSON에서 userId 받음
    @PostMapping
    public UserDiseaseResponse addDisease(@RequestBody CreateUserDiseaseRequest req) {
        return userDiseaseService.addDisease(req.getUserId(), req);
    }

    // ✔ 마찬가지로 userId를 쿼리 파라미터 또는 요청 바디로 받는 버전
    @GetMapping
    public List<UserDiseaseResponse> getMyDiseases(@RequestParam String userId) {
        return userDiseaseService.getMyDiseases(userId);
    }
}
