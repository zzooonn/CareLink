package com.example.demo.controller;

import com.example.demo.entity.User;
import com.example.demo.entity.UserMedication;
import com.example.demo.entity.UserMedicationSchedule;
import com.example.demo.repository.MedicationRepository;
import com.example.demo.repository.UserRepository;
import com.example.demo.security.AccessControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/medications")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class MedicationController {

    private final MedicationRepository medicationRepository;
    private final UserRepository userRepository;
    private final AccessControlService accessControlService;

    @GetMapping("/{userId}")
    public ResponseEntity<List<Map<String, Object>>> getMedications(@PathVariable String userId) {
        accessControlService.ensureSelfOrLinkedGuardian(userId);
        List<Map<String, Object>> result = medicationRepository.findByUser_UserIdAndIsActiveTrue(userId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{userId}")
    public ResponseEntity<Map<String, Object>> addMedication(
            @PathVariable String userId,
            @RequestBody Map<String, String> body
    ) {
        accessControlService.ensureSelf(userId);
        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        UserMedication med = new UserMedication();
        med.setUser(user);
        med.setName(body.get("name"));
        med.setDosage(body.get("dosage"));
        med.setIsActive(true);

        String freq = body.get("freq");
        if (freq != null && !freq.isBlank()) {
            UserMedicationSchedule schedule = new UserMedicationSchedule();
            schedule.setMedication(med);
            schedule.setTimeOfDay(LocalTime.parse(freq));
            schedule.setDaysOfWeek("EVERYDAY");
            schedule.setTimezone("Asia/Seoul");
            med.getSchedules().add(schedule);
        }

        UserMedication saved = medicationRepository.save(med);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @PutMapping("/{userId}/{medId}")
    public ResponseEntity<Map<String, Object>> updateMedication(
            @PathVariable String userId,
            @PathVariable Long medId,
            @RequestBody Map<String, String> body
    ) {
        accessControlService.ensureSelf(userId);
        UserMedication med = medicationRepository.findByIdAndUser_UserId(medId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Medication not found"));

        if (body.get("name") != null) med.setName(body.get("name"));
        if (body.get("dosage") != null) med.setDosage(body.get("dosage"));

        String freq = body.get("freq");
        if (freq != null && !freq.isBlank()) {
            med.getSchedules().clear();
            UserMedicationSchedule schedule = new UserMedicationSchedule();
            schedule.setMedication(med);
            schedule.setTimeOfDay(LocalTime.parse(freq));
            schedule.setDaysOfWeek("EVERYDAY");
            schedule.setTimezone("Asia/Seoul");
            med.getSchedules().add(schedule);
        }

        UserMedication saved = medicationRepository.save(med);
        return ResponseEntity.ok(toResponse(saved));
    }

    @DeleteMapping("/{userId}/{medId}")
    public ResponseEntity<Void> deleteMedication(
            @PathVariable String userId,
            @PathVariable Long medId
    ) {
        accessControlService.ensureSelf(userId);
        UserMedication med = medicationRepository.findByIdAndUser_UserId(medId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Medication not found"));
        med.setIsActive(false);
        medicationRepository.save(med);
        return ResponseEntity.noContent().build();
    }

    private Map<String, Object> toResponse(UserMedication med) {
        String freq = med.getSchedules().isEmpty() ? "" :
                med.getSchedules().get(0).getTimeOfDay().toString();
        return Map.of(
                "id", String.valueOf(med.getId()),
                "name", med.getName() != null ? med.getName() : "",
                "dosage", med.getDosage() != null ? med.getDosage() : "",
                "freq", freq
        );
    }
}
