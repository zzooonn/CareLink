package com.example.demo.push;

/**
 * 알림 행(user_health_alert)이 저장됐을 때 발행되는 이벤트.
 * 리스너는 트랜잭션이 커밋된 뒤 별도 스레드에서 실행되므로,
 * 지연 로딩 엔티티 대신 발송에 필요한 값만 담는다.
 */
public record AlertCreatedEvent(
        Long alertId,
        String receiverPushToken,
        String alertType,
        String title,
        String message
) {}
