package com.example.demo.push;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Expo Push API 호출을 담당한다.
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */
@Slf4j
@Component
public class ExpoPushClient {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String pushUrl;
    private final String accessToken;
    private final boolean enabled;

    public ExpoPushClient(
            RestTemplateBuilder restTemplateBuilder,
            ObjectMapper objectMapper,
            @Value("${expo.push.url:https://exp.host/--/api/v2/push/send}") String pushUrl,
            @Value("${expo.push.access-token:}") String accessToken,
            @Value("${expo.push.enabled:true}") boolean enabled) {
        this.restTemplate = restTemplateBuilder
                .connectTimeout(Duration.ofSeconds(5))
                .readTimeout(Duration.ofSeconds(10))
                .build();
        this.objectMapper = objectMapper;
        this.pushUrl = pushUrl;
        this.accessToken = accessToken;
        this.enabled = enabled;
    }

    /** Expo 푸시 토큰 형식인지 확인 (ExponentPushToken[...] 또는 ExpoPushToken[...]) */
    public static boolean isExpoPushToken(String token) {
        return token != null
                && (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["))
                && token.endsWith("]");
    }

    public PushSendResult send(String token, String title, String body, Map<String, Object> data) {
        if (!enabled) {
            log.info("[Push] disabled — skip sending '{}'", title);
            return PushSendResult.OK;
        }
        if (!isExpoPushToken(token)) {
            log.warn("[Push] invalid Expo push token, skip");
            return PushSendResult.DEVICE_NOT_REGISTERED;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        if (accessToken != null && !accessToken.isBlank()) {
            headers.setBearerAuth(accessToken);
        }

        Map<String, Object> message = Map.of(
                "to", token,
                "title", title,
                "body", body,
                "sound", "default",
                "priority", "high",
                "channelId", "default",
                "data", data
        );

        try {
            String response = restTemplate.postForObject(
                    pushUrl, new HttpEntity<>(List.of(message), headers), String.class);
            return parseTicket(response);
        } catch (Exception e) {
            log.error("[Push] Expo request failed: {}", e.getMessage());
            return PushSendResult.FAILED;
        }
    }

    /**
     * 응답 예:
     *   {"data":[{"status":"ok","id":"..."}]}
     *   {"data":[{"status":"error","message":"...","details":{"error":"DeviceNotRegistered"}}]}
     */
    PushSendResult parseTicket(String response) {
        try {
            JsonNode ticket = objectMapper.readTree(response).path("data").path(0);
            if ("ok".equals(ticket.path("status").asText())) {
                return PushSendResult.OK;
            }
            String error = ticket.path("details").path("error").asText("");
            log.warn("[Push] Expo ticket error: {} ({})", ticket.path("message").asText(), error);
            return "DeviceNotRegistered".equals(error)
                    ? PushSendResult.DEVICE_NOT_REGISTERED
                    : PushSendResult.FAILED;
        } catch (Exception e) {
            log.error("[Push] cannot parse Expo response: {}", e.getMessage());
            return PushSendResult.FAILED;
        }
    }
}
