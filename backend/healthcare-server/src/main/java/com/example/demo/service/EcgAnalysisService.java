package com.example.demo.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class EcgAnalysisService {

    private final String aiServerUrl;
    private final RestTemplate restTemplate;

    private final String aiApiKey;

    public EcgAnalysisService(
            @Value("${ai.ecg.server-url:https://zoon1-carelink-ai.hf.space/predict_window}") String aiServerUrl,
            @Value("${ai.ecg.api-key:}") String aiApiKey,
            @Value("${ai.ecg.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${ai.ecg.read-timeout-ms:30000}") int readTimeoutMs) {
        this.aiServerUrl = aiServerUrl;
        this.aiApiKey = aiApiKey;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeoutMs);
        factory.setReadTimeout(readTimeoutMs);
        this.restTemplate = new RestTemplate(factory);
    }

    public String analyzeEcg(List<List<Double>> ecgData) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (aiApiKey != null && !aiApiKey.isBlank()) {
            headers.set("X-API-Key", aiApiKey);
        }

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("x", ecgData);
        requestBody.put("fs", 500);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(aiServerUrl, entity, String.class);
            return response.getBody();
        } catch (Exception e) {
            log.error("[EcgAnalysisService] AI server communication failed", e);
            return "{\"error\": \"AI 서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.\"}";
        }
    }
}
