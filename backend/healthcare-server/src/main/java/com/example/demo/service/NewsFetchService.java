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

        String url =
            "https://newsapi.org/v2/everything?"
                + "q=" + keyword
                + "&language=en"
                + "&sortBy=publishedAt"
                + "&pageSize=5"
                + "&apiKey=" + apiKey;



        log.info("[news] query={}", keyword);

        ResponseEntity<String> response =
                restTemplate.exchange(
                        url,
                        HttpMethod.GET,
                        null,
                        String.class
                );

        return response.getBody();
    }
}
