package com.example.demo.dto.auth;

import java.time.LocalDate;

public record UpdateUserProfileRequest(
        String name,
        String gender,
        LocalDate birthDate,
        String phone,
        String address
) {}
