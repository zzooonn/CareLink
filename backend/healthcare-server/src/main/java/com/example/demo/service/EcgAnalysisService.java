package com.example.demo.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.util.HashMap;
import java.util.List;
import java.util.Map;



@Service
public class EcgAnalysisService {

    // Hugging Face AI 서버 주소
    private final String AI_SERVER_URL = "https://zoon1-carelink-ai.hf.space/predict_window";

    public String analyzeEcg(List<List<Double>> ecgData) {
        RestTemplate restTemplate = new RestTemplate();

        // 1. 헤더 설정 (JSON 형태로 보낸다고 명시)
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        // 2. 바디 데이터 구성 (server.py의 PredictReq 구조와 일치해야 함)
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("x", ecgData);
        requestBody.put("fs", 500); // 현준님 모델의 기본 주파수

        // 3. 요청 객체 생성
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        try {
            // 4. Hugging Face로 POST 요청 전송
            ResponseEntity<String> response = restTemplate.postForEntity(AI_SERVER_URL, entity, String.class);
            
            // AI 서버가 준 결과 리턴 (probs, active_labels, risk_level 등 포함됨)
            return response.getBody();
        } catch (Exception e) {
            // 연결 실패나 타임아웃 발생 시 에러 처리
            return "{\"error\": \"AI 서버 통신 실패: " + e.getMessage() + "\"}";
        }
    }
}