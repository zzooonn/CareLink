package com.example.demo.controller;

import com.example.demo.repository.DiseaseTrendRepository;
import lombok.RequiredArgsConstructor;
import com.example.demo.repository.*;
import com.example.demo.entity.User;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;
import com.example.demo.service.NewsAutoCollectorService;

import java.util.List;

@RestController
@RequestMapping("/api/news")
@RequiredArgsConstructor
public class NewsController {

    private final NewsAutoCollectorService newsAutoCollectorService;
    private final DiseaseTrendRepository diseaseTrendRepository;
    private final UserRepository userRepository;

    // ✅ 즉시 수집 (유저 기준)
    @PostMapping("/refresh")
    public void refresh(@RequestParam String userId) {
        newsAutoCollectorService.collectNewsForUser(userId);
    }

    // ✅ 조회
    @GetMapping
    public List<NewsItemDto> latest(
            @RequestParam String userId,
            @RequestParam(defaultValue = "5") int limit
    ) {
        int size = Math.max(1, Math.min(limit, 20));

        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        var page = diseaseTrendRepository.findByUser_IdAndAdvisoryTypeOrderByIdDesc(
                user.getId(), "NEWS", PageRequest.of(0, size)
        );

        return page.getContent().stream()
                .map(t -> new NewsItemDto(t.getId(), t.getDiseaseName(), t.getAdvisoryText(), t.getSourceUrl()))
                .toList();
    }

    public record NewsItemDto(Long id, String diseaseName, String title, String url) {}
}
