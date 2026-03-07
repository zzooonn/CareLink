package com.example.demo.service;

import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.dto.auth.LoginRequest;
import com.example.demo.dto.auth.LoginResponse;
import com.example.demo.dto.auth.RegisterRequest;
import com.example.demo.entity.User;
import com.example.demo.entity.UserRole;
import com.example.demo.repository.UserRepository;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);

    public LoginResponse login(LoginRequest req) {
        Optional<User> userOptional = userRepository.findByUserId(req.getUserId());

        if (userOptional.isEmpty()) {
            logger.warn("Login failed: user not found for userId='{}'", req.getUserId());
            return new LoginResponse(false, "user not found !! ", null, null);
        }

        User user = userOptional.get();
        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            logger.warn("Login failed: invalid password for userId='{}'", req.getUserId());
            return new LoginResponse(false, "Invalid password", null, null);
        }

        String dummyToken = "jwt.token.placeholder";

        logger.info("Login successful for userId='{}'", req.getUserId());
        return new LoginResponse(true, "Login successful", dummyToken, user.getUserId());
    }

    public User register(RegisterRequest request) {
        String normalizedUserId = request.getUserId() == null ? "" : request.getUserId().trim();
        if (normalizedUserId.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId is required");
        }

        if (userRepository.findByUserId(normalizedUserId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "userId already exists");
        }

        if (request.getBirthDate() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "birthDate is required (yyyy-MM-dd)");
        }

        User user = new User();
        user.setUserId(normalizedUserId);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setName(request.getName() == null ? "" : request.getName().trim());

        String gender = request.getGender();
        user.setGender((gender == null || gender.isBlank()) ? "UNKNOWN" : gender.trim());

        user.setBirthDate(request.getBirthDate());
        user.setPhone(request.getPhone() == null ? "" : request.getPhone().trim());
        user.setAddress(request.getAddress() == null ? "" : request.getAddress().trim());

        if (request.getRole() == null) {
            user.setRole(UserRole.PATIENT);
        } else {
            user.setRole(request.getRole());
        }

        if (request.getProfileImageId() == null) {
            user.setProfileImageId(1);
        } else {
            user.setProfileImageId(request.getProfileImageId());
        }

        return userRepository.save(user);
    }
}
