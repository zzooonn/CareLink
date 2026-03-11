package com.example.demo.dto.auth;

import java.time.LocalDate;

import com.example.demo.entity.UserRole;
import com.fasterxml.jackson.annotation.JsonFormat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegisterRequest {

    @NotBlank(message = "아이디는 필수 입력 항목입니다.")
    private String userId;

    @NotBlank(message = "비밀번호는 필수 입력 항목입니다.")
    @Pattern(
        regexp = "^(?=.*[A-Za-z])(?=.*\\d).{8,}$",
        message = "Password must be at least 8 characters and include both letters and numbers."
    )
    private String password;

    @NotBlank(message = "이름은 필수 입력 항목입니다.")
    private String name;
    private String gender;

    @NotNull(message = "생년월일은 필수 입력 항목입니다.")
    @Past(message = "생년월일은 현재 날짜보다 이전이어야 합니다.")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate birthDate;

    private String phone;
    private String address;
    private Integer profileImageId;

    private UserRole role;   // PATIENT / GUARDIAN (프론트에서 선택해서 보내게 할 거면)

    private String guardianId;  // optional: link patient to existing guardian at signup
}