package com.example.demo.push;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Map;

/**
 * 알림 행 저장이 커밋된 뒤에만 실제 푸시를 보낸다.
 * - AFTER_COMMIT: 저장이 롤백되면 푸시도 나가지 않음 (앱에 없는 알림이 뜨는 일 방지)
 * - @Async: Expo 서버가 느려도 혈압 저장 API 응답은 기다리지 않음
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PushNotificationListener {

    private final ExpoPushClient expoPushClient;
    private final PushTokenService pushTokenService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onAlertCreated(AlertCreatedEvent event) {
        if (event.receiverPushToken() == null || event.receiverPushToken().isBlank()) {
            log.debug("[Push] receiver has no push token, alertId={}", event.alertId());
            return;
        }

        PushSendResult result = expoPushClient.send(
                event.receiverPushToken(),
                event.title(),
                event.message(),
                Map.of("alertId", event.alertId(), "alertType", event.alertType()));

        if (result == PushSendResult.DEVICE_NOT_REGISTERED) {
            pushTokenService.clearToken(event.receiverPushToken());
        }
    }
}
