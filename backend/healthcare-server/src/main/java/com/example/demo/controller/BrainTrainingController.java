package com.example.demo.controller;

import com.example.demo.entity.BrainTrainingGame;
import com.example.demo.entity.User;
import com.example.demo.repository.BrainTrainingRepository;
import com.example.demo.repository.UserRepository;
import com.example.demo.security.AccessControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/brain-training")
@RequiredArgsConstructor
public class BrainTrainingController {

    private final BrainTrainingRepository brainTrainingRepository;
    private final UserRepository userRepository;
    private final AccessControlService accessControlService;

    // 점수 저장
    @PostMapping("/{userId}")
    public ResponseEntity<Map<String, Object>> saveScore(
            @PathVariable String userId,
            @RequestBody Map<String, Long> body
    ) {
        accessControlService.ensureSelf(userId);
        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Long score = body.get("score");
        if (score == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "score is required");
        }

        BrainTrainingGame game = new BrainTrainingGame();
        game.setUser(user);
        game.setScore(score);
        brainTrainingRepository.save(game);

        Long bestScore = brainTrainingRepository.findBestScoreByUser(user).orElse(score);

        return ResponseEntity.ok(Map.of(
                "score", score,
                "bestScore", bestScore
        ));
    }

    // 최고점수 + 최근 기록 조회
    @GetMapping("/{userId}")
    public ResponseEntity<Map<String, Object>> getScores(@PathVariable String userId) {
        accessControlService.ensureSelf(userId);
        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Long bestScore = brainTrainingRepository.findBestScoreByUser(user).orElse(0L);

        List<Map<String, Object>> recent = brainTrainingRepository
                .findByUserOrderByCreatedAtDesc(user)
                .stream()
                .limit(10)
                .map(g -> Map.<String, Object>of(
                        "score", g.getScore(),
                        "createdAt", g.getCreatedAt().toString()
                ))
                .toList();

        return ResponseEntity.ok(Map.of(
                "bestScore", bestScore,
                "recent", recent
        ));
    }
}
