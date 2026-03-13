package com.example.demo.controller;

import com.example.demo.entity.User;
import com.example.demo.repository.DiseaseTrendRepository;
import com.example.demo.repository.UserRepository;
import com.example.demo.security.AccessControlService;
import com.example.demo.service.NewsAutoCollectorService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;


import java.util.List;

@RestController
@RequestMapping("/api/news")
@RequiredArgsConstructor
public class NewsController {

    private final NewsAutoCollectorService newsAutoCollectorService;
    private final DiseaseTrendRepository diseaseTrendRepository;
    private final UserRepository userRepository;
    private final AccessControlService accessControlService;

    @PostMapping("/refresh")
    public void refresh(@RequestParam String userId) {
        accessControlService.ensureSelfOrLinkedGuardian(userId);
        newsAutoCollectorService.collectNewsForUser(userId);
    }

    @GetMapping
    public List<NewsItemDto> latest(
            @RequestParam String userId,
            @RequestParam(defaultValue = "5") int limit
    ) {
        accessControlService.ensureSelfOrLinkedGuardian(userId);
        int size = Math.max(1, Math.min(limit, 20));

        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + userId));

        var page = diseaseTrendRepository.findByUser_IdAndAdvisoryTypeOrderByIdDesc(
                user.getId(), "NEWS", PageRequest.of(0, size)
        );

        return page.getContent().stream()
                .map(t -> new NewsItemDto(t.getId(), t.getDiseaseName(), t.getAdvisoryText(), t.getSourceUrl()))
                .toList();
    }

    public record NewsItemDto(Long id, String diseaseName, String title, String url) {
    }
}
