package com.example.demo.service;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.example.demo.dto.auth.LoginRequest;
import com.example.demo.dto.auth.LoginResponse;
import com.example.demo.dto.auth.RegisterRequest;
import com.example.demo.entity.User;
import com.example.demo.entity.UserRole;
import com.example.demo.repository.UserRepository;

@Service
public class AuthService {
    
    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);

    public LoginResponse login(LoginRequest req){
        Optional<User> userOptional = userRepository.findByUserId(req.getUserId());

        if(userOptional.isEmpty()){
            logger.warn("Login failed: user not found for userId='{}'", req.getUserId());
            return new LoginResponse(false, "user not found !! ", null, null); 
        }

        User user = userOptional.get();
        if(!passwordEncoder.matches(req.getPassword(), user.getPassword())){
            logger.warn("Login failed: invalid password for userId='{}'", req.getUserId());
            return new LoginResponse(false, "Invalid password", null, null); 
        }

        // TODO: 여기에 실제 JWT 생성 로직을 넣어야 합니다.
        // 현재는 컴파일을 위해 임시 토큰을 사용합니다.
        String dummyToken = "jwt.token.placeholder"; 
        
        logger.info("Login successful for userId='{}'", req.getUserId());
        return new LoginResponse(true, "Login successful", dummyToken, user.getUserId()); 
    }


    public String register(RegisterRequest request){
        if(userRepository.findByUserId(request.getUserId()).isPresent()){
            return "User Id is already Exist";
        }

        User user = new User();
        user.setUserId(request.getUserId());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setName(request.getName());
        user.setGender(request.getGender());
        user.setBirthDate(request.getBirthDate());
        user.setPhone(request.getPhone());
        user.setAddress(request.getAddress());

        // role 처리
        if (request.getRole() == null) {
            user.setRole(UserRole.PATIENT);
        } else {
            user.setRole(request.getRole());
        }

        // ✅ profileImageId 처리 (핵심)
        if (request.getProfileImageId() == null) {
            user.setProfileImageId(1);
        } else {
            user.setProfileImageId(request.getProfileImageId());
        }

        userRepository.save(user);
        return "회원 가입 성공 !!";
    }

}
