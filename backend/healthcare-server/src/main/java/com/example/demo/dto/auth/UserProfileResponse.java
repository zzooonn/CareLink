package com.example.demo.dto.auth;

import java.time.LocalDate;
import com.example.demo.entity.UserRole;

public record UserProfileResponse(
        String userId,
        String name,
        String gender,
        LocalDate birthDate,
        String phone,
        String address,
        UserRole role,
        Integer profileImageId
) {}
