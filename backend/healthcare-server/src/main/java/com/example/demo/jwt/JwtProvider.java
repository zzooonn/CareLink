package com.example.demo.jwt;

import com.example.demo.entity.UserRole;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

@Component
public class JwtProvider {

    private final SecretKey key;
    private final long expiration;

    // application.properties에서 값을 주입받아 SecretKey를 생성합니다.
    public JwtProvider(@Value("${jwt.secret}") String secretKey, 
                       @Value("${jwt.expiration}") long expiration) {
        // Base64 디코딩하여 안전한 SecretKey 객체를 생성
        byte[] keyBytes = Decoders.BASE64.decode(secretKey);
        this.key = Keys.hmacShaKeyFor(keyBytes);
        this.expiration = expiration;
    }

    /**
     * 사용자 정보와 권한을 포함한 JWT 토큰을 생성합니다.
     */
    public String createToken(String userId, UserRole role) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expiration);

        return Jwts.builder()
                .subject(userId) // 토큰의 주체 (여기서는 userId)
                .claim("role", role.name()) // 사용자 권한(role) 정보 추가
                .issuedAt(now) // 토큰 발행 시간
                .expiration(expiryDate) // 토큰 만료 시간
                .signWith(key) // Secret Key로 서명
                .compact(); // 토큰 생성
    }
    
    // (TODO: 토큰 유효성 검사, 정보 추출 등 로직이 추가될 예정)
}