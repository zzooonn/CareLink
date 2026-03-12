package com.example.demo.security;

import com.example.demo.entity.User;
import com.example.demo.entity.UserRole;
import com.example.demo.repository.UserGuardianLinkRepository;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AccessControlService {

    private final UserRepository userRepository;
    private final UserGuardianLinkRepository userGuardianLinkRepository;

    public String currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null || "anonymousUser".equals(authentication.getName())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return authentication.getName();
    }

    public User currentUser() {
        return userRepository.findByUserId(currentUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user not found"));
    }

    public void ensureSelf(String userId) {
        if (!currentUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only access your own account");
        }
    }

    public void ensureSelfOrLinkedGuardian(String patientUserId) {
        User actor = currentUser();
        if (actor.getUserId().equals(patientUserId)) {
            return;
        }

        User patient = userRepository.findByUserId(patientUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "user not found"));

        boolean linked = userGuardianLinkRepository.existsByPatientAndGuardian(patient, actor);
        if (!linked) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this user's data");
        }
    }

    public void ensureGuardianSelf(String guardianUserId) {
        ensureSelf(guardianUserId);
        boolean isGuardian = currentUser().getRole() == UserRole.GUARDIAN || hasAuthority("ROLE_GUARDIAN");
        if (!isGuardian) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Guardian account required");
        }
    }

    public void ensureSelfOrConnectionParticipant(String patientId, String guardianId) {
        String actorUserId = currentUserId();
        if (!actorUserId.equals(patientId) && !actorUserId.equals(guardianId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the patient or guardian can manage this link");
        }
    }

    private boolean hasAuthority(String authority) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority::equals);
    }
}
