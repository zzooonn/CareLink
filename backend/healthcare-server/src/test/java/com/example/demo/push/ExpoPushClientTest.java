package com.example.demo.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ExpoPushClientTest {

    private final ExpoPushClient client = new ExpoPushClient(
            new RestTemplateBuilder(), new ObjectMapper(), "http://localhost/unused", "", true);

    @Test
    void 정상_티켓은_OK() {
        assertThat(client.parseTicket("{\"data\":[{\"status\":\"ok\",\"id\":\"x\"}]}"))
                .isEqualTo(PushSendResult.OK);
    }

    @Test
    void DeviceNotRegistered_티켓은_토큰_삭제_대상() {
        String body = "{\"data\":[{\"status\":\"error\",\"message\":\"not registered\","
                + "\"details\":{\"error\":\"DeviceNotRegistered\"}}]}";
        assertThat(client.parseTicket(body)).isEqualTo(PushSendResult.DEVICE_NOT_REGISTERED);
    }

    @Test
    void 그_밖의_오류와_깨진_응답은_FAILED() {
        assertThat(client.parseTicket("{\"data\":[{\"status\":\"error\",\"details\":{\"error\":\"MessageRateExceeded\"}}]}"))
                .isEqualTo(PushSendResult.FAILED);
        assertThat(client.parseTicket("not json")).isEqualTo(PushSendResult.FAILED);
    }

    @Test
    void Expo_토큰_형식만_허용한다() {
        assertThat(ExpoPushClient.isExpoPushToken("ExponentPushToken[abc]")).isTrue();
        assertThat(ExpoPushClient.isExpoPushToken("ExpoPushToken[abc]")).isTrue();
        assertThat(ExpoPushClient.isExpoPushToken("fcm-token-123")).isFalse();
        assertThat(ExpoPushClient.isExpoPushToken(null)).isFalse();
    }

    @Test
    void 잘못된_토큰은_네트워크_호출_없이_DEVICE_NOT_REGISTERED() {
        assertThat(client.send("bad", "t", "b", Map.of())).isEqualTo(PushSendResult.DEVICE_NOT_REGISTERED);
    }
}
