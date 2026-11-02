package com.example.demo.push;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class PushNotificationListenerTest {

    @Mock ExpoPushClient expoPushClient;
    @Mock PushTokenService pushTokenService;
    @InjectMocks PushNotificationListener listener;

    private static final String TOKEN = "ExponentPushToken[abc]";

    @Test
    void 토큰이_없으면_보내지_않는다() {
        listener.onAlertCreated(new AlertCreatedEvent(1L, null, "HIGH_BP", "혈압 이상", "150/95"));

        verify(expoPushClient, never()).send(any(), any(), any(), any());
    }

    @Test
    void 앱이_삭제된_기기면_토큰을_지운다() {
        given(expoPushClient.send(eq(TOKEN), anyString(), anyString(), anyMap()))
                .willReturn(PushSendResult.DEVICE_NOT_REGISTERED);

        listener.onAlertCreated(new AlertCreatedEvent(1L, TOKEN, "HIGH_BP", "혈압 이상", "150/95"));

        verify(pushTokenService).clearToken(TOKEN);
    }

    @Test
    void 일시적_실패면_토큰을_유지한다() {
        given(expoPushClient.send(eq(TOKEN), anyString(), anyString(), anyMap()))
                .willReturn(PushSendResult.FAILED);

        listener.onAlertCreated(new AlertCreatedEvent(1L, TOKEN, "HIGH_BP", "혈압 이상", "150/95"));

        verify(pushTokenService, never()).clearToken(any());
    }
}
