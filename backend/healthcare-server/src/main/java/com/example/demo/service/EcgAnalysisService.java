package com.example.demo.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class EcgAnalysisService {

    private final String baseUrl;
    private final String aiApiKey;
    private final RestTemplate restTemplate;

    public EcgAnalysisService(
            @Value("${ai.ecg.server-url:http://ai:8000}") String aiServerUrl,
            @Value("${ai.ecg.api-key:}") String aiApiKey,
            @Value("${ai.ecg.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${ai.ecg.read-timeout-ms:30000}") int readTimeoutMs) {
        // path가 포함된 이전 URL 값도 안전하게 처리 (예: http://ai:8000/predict_window → http://ai:8000)
        this.baseUrl = aiServerUrl.replaceAll("/predict_window$", "").replaceAll("/$", "");
        this.aiApiKey = aiApiKey;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeoutMs);
        factory.setReadTimeout(readTimeoutMs);
        this.restTemplate = new RestTemplate(factory);
    }

    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (aiApiKey != null && !aiApiKey.isBlank()) {
            headers.set("X-API-Key", aiApiKey);
        }
        return headers;
    }

    public String analyzeEcg(List<List<Double>> ecgData, Integer fs) {
        Map<String, Object> body = Map.of(
                "x", ecgData,
                "fs", fs != null ? fs : 500
        );
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, buildHeaders());
        try {
            ResponseEntity<String> response = restTemplate.postForEntity(
                    baseUrl + "/predict_window", entity, String.class);
            return response.getBody();
        } catch (Exception e) {
            log.error("[ECG] predict_window 실패: {}", e.getMessage());
            return "{\"error\": \"AI 서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.\"}";
        }
    }

    public String sampleWindow(String label) {
        HttpEntity<Void> entity = new HttpEntity<>(buildHeaders());
        try {
            UriComponentsBuilder uri = UriComponentsBuilder
                    .fromUriString(baseUrl + "/sample_window");
            if (label != null && !label.isBlank()) {
                uri.queryParam("label", label);
            }
            ResponseEntity<String> response = restTemplate.exchange(
                    uri.toUriString(), HttpMethod.GET, entity, String.class);
            return response.getBody();
        } catch (Exception e) {
            log.error("[ECG] sample_window 실패: {}", e.getMessage());
            return "{\"error\": \"샘플 데이터를 불러올 수 없습니다.\"}";
        }
    }
}
