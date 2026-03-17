package com.example.demo.service;

import com.example.demo.dto.auth.LoginRequest;
import com.example.demo.dto.auth.LoginResponse;
import com.example.demo.dto.auth.RegisterRequest;
import com.example.demo.entity.User;
import com.example.demo.entity.UserGuardianLink;
import com.example.demo.entity.UserRole;
import com.example.demo.jwt.JwtProvider;
import com.example.demo.repository.UserGuardianLinkRepository;
import com.example.demo.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtProvider jwtProvider;

    @Autowired
    private UserGuardianLinkRepository userGuardianLinkRepository;

    @Autowired
    private PasswordResetTokenService passwordResetTokenService;

    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);

    public LoginResponse login(LoginRequest req) {
        Optional<User> userOptional = userRepository.findByUserId(req.getUserId());

        if (userOptional.isEmpty()) {
            logger.warn("Login failed: user not found for userId='{}'", req.getUserId());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found");
        }

        User user = userOptional.get();
        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            logger.warn("Login failed: invalid password for userId='{}'", req.getUserId());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid password");
        }

        String token = jwtProvider.createToken(user.getUserId(), user.getRole());
        String refreshToken = jwtProvider.createRefreshToken(user.getUserId());

        logger.info("Login successful for userId='{}'", req.getUserId());
        return new LoginResponse(true, "Login successful", token, user.getUserId(), refreshToken);
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
        user.setRole(request.getRole() == null ? UserRole.PATIENT : request.getRole());
        user.setProfileImageId(request.getProfileImageId() == null ? 1 : request.getProfileImageId());

        User saved = userRepository.save(user);

        String gid = request.getGuardianId();
        if (saved.getRole() == UserRole.PATIENT && gid != null && !gid.isBlank()) {
            userRepository.findByUserId(gid.trim()).ifPresent(guardian -> {
                if (!userGuardianLinkRepository.existsByPatientAndGuardian(saved, guardian)) {
                    UserGuardianLink link = new UserGuardianLink();
                    link.setPatient(saved);
                    link.setGuardian(guardian);
                    link.setRelationType("FAMILY");
                    userGuardianLinkRepository.save(link);
                }
            });
        }

        return saved;
    }

    public LoginResponse refreshToken(String refreshToken) {
        if (refreshToken == null || !jwtProvider.validateToken(refreshToken)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token");
        }
        if (!jwtProvider.isRefreshToken(refreshToken)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not a refresh token");
        }
        String userId = jwtProvider.getUserId(refreshToken);
        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        String newToken = jwtProvider.createToken(user.getUserId(), user.getRole());
        String newRefreshToken = jwtProvider.createRefreshToken(user.getUserId());
        return new LoginResponse(true, "Token refreshed", newToken, user.getUserId(), newRefreshToken);
    }

    public String verifyIdentity(String userId, String birthDateStr) {
        if (userId == null || userId.isBlank() || birthDateStr == null || birthDateStr.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId and birthDate are required");
        }
        LocalDate birthDate;
        try {
            birthDate = LocalDate.parse(birthDateStr.trim());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date format. Use yyyy-MM-dd");
        }
        userRepository.findByUserIdAndBirthDate(userId.trim(), birthDate)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "ID or date of birth does not match"));
        return passwordResetTokenService.issueToken(userId.trim());
    }

    public String findUserId(String name, String birthDateStr, String phone) {
        if (name == null || name.isBlank() || birthDateStr == null || birthDateStr.isBlank() || phone == null || phone.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name, birthDate and phone are required");
        }
        LocalDate birthDate;
        try {
            birthDate = LocalDate.parse(birthDateStr.trim());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date format. Use yyyy-MM-dd");
        }
        String normalizedPhone = phone.trim().replaceAll("[^\\d+]", "");
        return userRepository.findByNameIgnoreCaseAndBirthDateAndPhone(name.trim(), birthDate, normalizedPhone)
                .map(User::getUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No matching user found"));
    }

    public void resetPassword(String userId, String newPassword, String resetToken) {
        if (userId == null || userId.isBlank() || newPassword == null || newPassword.isBlank() || resetToken == null || resetToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId, newPassword and resetToken are required");
        }
        User user = userRepository.findByUserId(userId.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        passwordResetTokenService.validateToken(user.getUserId(), resetToken.trim());
        user.setPassword(passwordEncoder.encode(newPassword.trim()));
        userRepository.save(user);
        passwordResetTokenService.consumeToken(user.getUserId());
    }
}
