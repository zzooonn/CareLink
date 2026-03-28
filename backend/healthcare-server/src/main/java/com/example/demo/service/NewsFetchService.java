package com.example.demo.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

@Slf4j
@Service
public class NewsFetchService {

    @Value("${news.api.key}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    public String fetchNews(String keyword) {

        if (apiKey == null || apiKey.isBlank()) {
            log.warn("[news] NEWS_API_KEY is not configured — skipping fetch for keyword={}", keyword);
            return null;
        }

        String url = UriComponentsBuilder
                .fromHttpUrl("https://newsapi.org/v2/everything")
                .queryParam("q", keyword)
                .queryParam("language", "en")
                .queryParam("sortBy", "publishedAt")
                .queryParam("pageSize", 5)
                .queryParam("apiKey", apiKey)
                .build()
                .toUriString();

        log.info("[news] query={}", keyword);

        try {
            ResponseEntity<String> response =
                    restTemplate.exchange(url, HttpMethod.GET, null, String.class);
            return response.getBody();
        } catch (Exception e) {
            log.error("[news] Failed to fetch news for keyword={}: {}", keyword, e.getMessage());
            return null;
        }
    }
}
