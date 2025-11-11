package com.example.demo.service;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.demo.dto.auth.LoginRequest;
import com.example.demo.dto.auth.LoginResponse;
import com.example.demo.dto.auth.RegisterRequest;
import com.example.demo.entity.User;
import com.example.demo.repository.UserRepository;

@Service
public class AuthService {
    
    @Autowired
    private UserRepository userRepository;

    public LoginResponse login(LoginRequest req){
        Optional<User> userOptional = userRepository.findByUserId(req.getUserId());

        if(userOptional.isEmpty()){
            return new LoginResponse(false, "user not found !! ");
        }

        User user = userOptional.get();
        if(!user.getPassword().equals(req.getPassword())){
            return new LoginResponse(false, "Invalid password");
        }

        return new LoginResponse(true, "Login successful");
    }


    public String register(RegisterRequest request){
        if(userRepository.findByUserId(request.getUserId()).isPresent()){
            return "User Id is already Exist";
        }

        User user = new User();
        user.setUserId(request.getUserId());
        user.setPassword(request.getPassword());
        user.setName(request.getName());
        user.setGender(request.getGender());
        user.setBirthDate(request.getBirthDate());
        user.setPhone(request.getPhone());
        user.setAddress(request.getAddress());

        userRepository.save(user);

        return "Registration successful";
    }
}
