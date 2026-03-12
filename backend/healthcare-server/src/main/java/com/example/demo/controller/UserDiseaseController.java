package com.example.demo.controller;

import com.example.demo.dto.CreateUserDiseaseRequest;
import com.example.demo.dto.UserDiseaseResponse;
import com.example.demo.security.AccessControlService;
import com.example.demo.service.UserDiseaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/user-diseases")
@RequiredArgsConstructor
public class UserDiseaseController {

    private final UserDiseaseService userDiseaseService;
    private final AccessControlService accessControlService;

    @PostMapping
    public UserDiseaseResponse addDisease(@RequestBody CreateUserDiseaseRequest req) {
        accessControlService.ensureSelfOrLinkedGuardian(req.getUserId());
        return userDiseaseService.addDisease(req.getUserId(), req);
    }

    @GetMapping
    public List<UserDiseaseResponse> getMyDiseases(@RequestParam String userId) {
        accessControlService.ensureSelfOrLinkedGuardian(userId);
        return userDiseaseService.getMyDiseases(userId);
    }
}
