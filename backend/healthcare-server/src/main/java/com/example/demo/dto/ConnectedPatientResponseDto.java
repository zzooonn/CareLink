package com.example.demo.dto;

import java.time.LocalDate;
import com.example.demo.entity.User;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ConnectedPatientResponseDto {
    private String userId;      // 환자 로그인 ID
    private String name;        // 환자 이름
    private String phone;       // 전화번호
    private String gender;      // 성별
    private LocalDate birthDate; // 생년월일
    private String address;     // 주소

    public static ConnectedPatientResponseDto fromEntity(User user){
        ConnectedPatientResponseDto dto = new ConnectedPatientResponseDto();
        dto.setUserId(user.getUserId());
        dto.setName(user.getName());
        dto.setPhone(user.getPhone());
        dto.setGender(user.getGender());
        dto.setBirthDate(user.getBirthDate());
        dto.setAddress(user.getAddress());
        return dto;
    }
}
