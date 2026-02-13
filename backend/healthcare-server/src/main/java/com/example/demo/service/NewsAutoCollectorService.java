package com.example.demo.service;

import com.example.demo.dto.NewsApiResponse;
import com.example.demo.entity.DiseaseTrend;
import com.example.demo.entity.User;
import com.example.demo.entity.UserDisease;
import com.example.demo.repository.DiseaseTrendRepository;
import com.example.demo.repository.UserDiseaseRepository;
import com.example.demo.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class NewsAutoCollectorService {

    private final UserDiseaseRepository userDiseaseRepository;
    private final DiseaseTrendRepository diseaseTrendRepository;
    private final UserRepository userRepository;
    private final NewsFetchService newsFetchService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ✅ (스케줄러용) 전체 유저 갱신
    @Transactional
    public void collectNewsFromUserDiseases() {
        List<UserDisease> all = userDiseaseRepository.findAll();

        Map<String, Set<String>> userIdToCodes = all.stream()
                .filter(ud -> ud.getUser() != null)
                .filter(ud -> ud.getUser().getUserId() != null && !ud.getUser().getUserId().isBlank())
                .filter(ud -> ud.getDiseaseCode() != null && !ud.getDiseaseCode().isBlank())
                .collect(Collectors.groupingBy(
                        ud -> ud.getUser().getUserId(),
                        Collectors.mapping(UserDisease::getDiseaseCode, Collectors.toSet())
                ));

        for (var entry : userIdToCodes.entrySet()) {
            collectNewsForUser(entry.getKey());
        }
    }

    // ✅ (즉시 반영용) 특정 유저만 갱신  ← 컨트롤러 /refresh가 이걸 호출
    @Transactional
    public void collectNewsForUser(String userId) {
        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        List<UserDisease> list = userDiseaseRepository.findByUserUserId(userId);

        Set<String> codes = list.stream()
                .map(UserDisease::getDiseaseCode)
                .filter(c -> c != null && !c.isBlank())
                .collect(Collectors.toSet());

        if (codes.isEmpty()) {
            log.warn("[NewsAutoCollector] No disease codes for userId={}", userId);
            // 유저가 질병 등록 안 했으면 기존 NEWS를 지울지 유지할지 정책 선택
            diseaseTrendRepository.deleteByUser_IdAndAdvisoryType(user.getId(), "NEWS");
            return;
        }

        for (String diseaseCode : codes) {
            String keyword = mapDiseaseCodeToKeyword(diseaseCode);

            // ✅ 유저 + 질병코드 + NEWS만 삭제 후 저장(유저별 갱신)
            diseaseTrendRepository.deleteByUser_IdAndDiseaseCodeAndAdvisoryType(
                    user.getId(), diseaseCode, "NEWS"
            );

            String newsJson = newsFetchService.fetchNews(keyword);
            List<NewsApiResponse.NewsArticle> articles = parseArticles(newsJson);

            List<NewsApiResponse.NewsArticle> top5 = articles.stream()
                    .filter(a -> a.getTitle() != null && !a.getTitle().isBlank())
                    .filter(a -> a.getUrl() != null && !a.getUrl().isBlank())
                    .sorted(Comparator.comparingInt(a -> -relevanceScore(a, keyword)))
                    .limit(5)
                    .toList();

            if (top5.isEmpty()) {
                log.warn("[NewsAutoCollector] No articles (userId={}, code={}, keyword={})",
                        userId, diseaseCode, keyword);
                continue;
            }

            for (NewsApiResponse.NewsArticle a : top5) {
                DiseaseTrend trend = new DiseaseTrend();

                // ✅ 가장 중요: 유저 연결 (이거 빠지면 /api/news?userId=... 조회가 비어버림)
                trend.setUser(user);

                trend.setDiseaseName(keyword);
                trend.setDiseaseCode(diseaseCode);
                trend.setTargetGroup(diseaseCode);
                trend.setRiskLevel("MEDIUM");
                trend.setAdvisoryType("NEWS");
                trend.setSource("NEWS_API");
                trend.setAdvisoryText(safeTrim(a.getTitle(), 300));
                trend.setSourceUrl(a.getUrl());

                diseaseTrendRepository.save(trend);
            }

            log.info("[NewsAutoCollector] Saved {} news (userId={}, code={}, keyword={})",
                    top5.size(), userId, diseaseCode, keyword);
        }
    }

    private List<NewsApiResponse.NewsArticle> parseArticles(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            NewsApiResponse resp = objectMapper.readValue(json, NewsApiResponse.class);
            return resp.getArticles() == null ? List.of() : resp.getArticles();
        } catch (Exception e) {
            log.error("[NewsAutoCollector] Failed to parse news JSON", e);
            return List.of();
        }
    }

    private int relevanceScore(NewsApiResponse.NewsArticle a, String keyword) {
        String k = keyword == null ? "" : keyword.toLowerCase();
        String title = lower(a.getTitle());
        String desc = lower(a.getDescription());
        String content = lower(a.getContent());

        int score = 0;
        if (!k.isBlank()) {
            if (title.contains(k)) score += 10;
            if (desc.contains(k)) score += 5;
            if (content.contains(k)) score += 3;

            for (String token : k.split("\\s+")) {
                if (token.length() < 3) continue;
                if (title.contains(token)) score += 3;
                if (desc.contains(token)) score += 2;
                if (content.contains(token)) score += 1;
            }
        }
        if (title.isBlank()) score -= 50;
        if (title.length() < 15) score -= 2;
        return score;
    }

    private String lower(String s) { return s == null ? "" : s.toLowerCase(); }

    private String safeTrim(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    private String mapDiseaseCodeToKeyword(String diseaseCode) {
        return switch (diseaseCode.toUpperCase()) {
            case "DM" -> "diabetes";
            case "HTN" -> "hypertension";
            case "FLU" -> "influenza";
            case "E11" -> "type 2 diabetes";
            default -> diseaseCode.toLowerCase();
        };
    }
}
