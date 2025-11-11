package com.example.demo.dto.auth;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegisterRequest {
    private String userId;
    private String password;
    private String name;
    private String gender;
    private String birthDate;
    private String phone;
    private String address;
}
