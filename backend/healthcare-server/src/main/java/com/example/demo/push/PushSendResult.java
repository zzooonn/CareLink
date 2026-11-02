package com.example.demo.push;

public enum PushSendResult {
    /** Expo 서버가 메시지를 접수함 */
    OK,
    /** 앱이 삭제됐거나 토큰이 더 이상 유효하지 않음 → 토큰을 지워야 함 */
    DEVICE_NOT_REGISTERED,
    /** 네트워크 오류 등 그 밖의 실패 (알림 행은 DB에 남아 있음) */
    FAILED
}
