package com.example.demo.controller;

import com.example.demo.dto.auth.UserProfileResponse;
import com.example.demo.dto.auth.UserUpdateRequest;
import com.example.demo.entity.User;
import com.example.demo.repository.UserRepository;
import com.example.demo.security.AccessControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@CrossOrigin(origins="*")
public class UserController {

    private final UserRepository userRepository;
    private final AccessControlService accessControlService;

    @GetMapping("/{userId}")
    public ResponseEntity<UserProfileResponse> getUser(@PathVariable String userId) {
        accessControlService.ensureSelfOrLinkedGuardian(userId);
        User u = userRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "user not found"));
        return ResponseEntity.ok(toResponse(u));
    }

    @PutMapping("/{userId}")
    public ResponseEntity<UserProfileResponse> updateUser(
            @PathVariable String userId,
            @RequestBody UserUpdateRequest req
    ) {
        accessControlService.ensureSelf(userId);
        User u = userRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "user not found"));

        if (req.name() != null) u.setName(req.name());
        if (req.gender() != null) u.setGender(req.gender());
        if (req.birthDate() != null) u.setBirthDate(req.birthDate());
        if (req.phone() != null) u.setPhone(req.phone());
        if (req.address() != null) u.setAddress(req.address());
        if (req.profileImageId() != null) u.setProfileImageId(req.profileImageId());

        userRepository.save(u);
        return ResponseEntity.ok(toResponse(u));
    }

    private UserProfileResponse toResponse(User u) {
        return new UserProfileResponse(
                u.getUserId(),
                u.getName(),
                u.getGender(),
                u.getBirthDate(),
                u.getPhone(),
                u.getAddress(),
                u.getRole(),
                u.getProfileImageId()
        );
    }
}
