package com.example.demo.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateHealthRecordRequest {

    private String userId;

    // 혈압 (없으면 null 가능)
    private Long bpSys;
    private Long bpDia;
    
    // 혈당 (없으면 null 가능)
    private Long glucose;
    
    // 측정 타입 (공복/식후)
    private Boolean isFasting;


    private Long heartRate;
    private Double ecgRiskScore;
    private Boolean ecgAbnormal;
    private String ecgAnomalyType;

}