package com.example.demo.push;

import com.example.demo.entity.User;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class PushTokenService {

    private final UserRepository userRepository;

    /**
     * 로그인한 사용자의 기기 토큰을 등록한다.
     * 같은 기기에서 다른 계정으로 로그인한 경우, 이전 계정의 토큰은 지운다.
     * (예: 환자 A가 로그아웃하지 않고 보호자 B로 로그인 → A의 알림이 B 화면에 뜨지 않게)
     */
    @Transactional
    public void register(String userId, String token) {
        if (!ExpoPushClient.isExpoPushToken(token)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Expo push token");
        }
        // 벌크 update는 영속성 컨텍스트를 비우므로, 사용자 조회보다 먼저 실행한다.
        userRepository.clearExpoPushTokenExceptUser(token, userId);

        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "user not found"));
        user.setExpoPushToken(token);
    }

    /** 로그아웃 시 이 사용자의 토큰을 지운다. */
    @Transactional
    public void unregister(String userId) {
        userRepository.findByUserId(userId).ifPresent(u -> u.setExpoPushToken(null));
    }

    /** Expo가 DeviceNotRegistered를 돌려준 토큰을 지운다. */
    @Transactional
    public void clearToken(String token) {
        userRepository.clearExpoPushToken(token);
    }
}
