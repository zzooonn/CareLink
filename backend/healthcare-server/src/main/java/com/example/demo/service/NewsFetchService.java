package com.example.demo.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

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

        String url =
            "https://newsapi.org/v2/everything?"
                + "q=" + keyword
                + "&language=en"
                + "&sortBy=publishedAt"
                + "&pageSize=5"
                + "&apiKey=" + apiKey;

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
