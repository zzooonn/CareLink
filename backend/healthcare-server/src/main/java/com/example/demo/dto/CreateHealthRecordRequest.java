package com.example.demo.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateHealthRecordRequest {

    @NotBlank(message = "userId는 필수입니다")
    private String userId;

    // 혈압 (없으면 null 가능) — 의학적 허용 범위
    @Min(value = 60, message = "수축기 혈압(bpSys)은 60 mmHg 이상이어야 합니다")
    @Max(value = 300, message = "수축기 혈압(bpSys)은 300 mmHg 이하이어야 합니다")
    private Long bpSys;

    @Min(value = 30, message = "이완기 혈압(bpDia)은 30 mmHg 이상이어야 합니다")
    @Max(value = 200, message = "이완기 혈압(bpDia)은 200 mmHg 이하이어야 합니다")
    private Long bpDia;

    // 혈당 (없으면 null 가능) — mg/dL 기준
    @Min(value = 20, message = "혈당(glucose)은 20 mg/dL 이상이어야 합니다")
    @Max(value = 600, message = "혈당(glucose)은 600 mg/dL 이하이어야 합니다")
    private Long glucose;

    // 측정 타입 (공복/식후)
    private Boolean isFasting;

    @Min(value = 20, message = "심박수(heartRate)는 20 bpm 이상이어야 합니다")
    @Max(value = 300, message = "심박수(heartRate)는 300 bpm 이하이어야 합니다")
    private Long heartRate;

    @DecimalMin(value = "0.0", message = "ECG 위험 점수(ecgRiskScore)는 0.0 이상이어야 합니다")
    @DecimalMax(value = "1.0", message = "ECG 위험 점수(ecgRiskScore)는 1.0 이하이어야 합니다")
    private Double ecgRiskScore;

    private Boolean ecgAbnormal;
    private String ecgAnomalyType;

}