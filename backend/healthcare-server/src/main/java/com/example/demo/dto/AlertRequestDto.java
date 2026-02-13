package com.example.demo.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class AlertRequestDto {
    private String userId;
    private String title;
    private String message;
    private String alertType;
}
