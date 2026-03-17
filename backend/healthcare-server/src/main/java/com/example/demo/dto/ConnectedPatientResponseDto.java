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
    private String userId;       // 로그인 ID
    private String name;         // 이름
    private String phone;        // 연락처 (보호자 링크의 contactPhone 우선, 없으면 계정 phone)
    private String gender;       // 성별
    private LocalDate birthDate; // 생년월일
    private String address;      // 주소

    /** 환자 목록 조회 시 사용 (contactPhone 없음) */
    public static ConnectedPatientResponseDto fromEntity(User user) {
        return fromEntity(user, null);
    }

    /** 보호자 목록 조회 시 사용 (contactPhone 우선) */
    public static ConnectedPatientResponseDto fromEntity(User user, String contactPhone) {
        ConnectedPatientResponseDto dto = new ConnectedPatientResponseDto();
        dto.setUserId(user.getUserId());
        dto.setName(user.getName());
        // 환자가 저장한 contactPhone이 있으면 우선 사용, 없으면 계정 등록 번호
        dto.setPhone(contactPhone != null && !contactPhone.isBlank() ? contactPhone : user.getPhone());
        dto.setGender(user.getGender());
        dto.setBirthDate(user.getBirthDate());
        dto.setAddress(user.getAddress());
        return dto;
    }
}
