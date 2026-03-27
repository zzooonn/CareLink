package com.example.demo.controller;

import com.example.demo.service.EcgAnalysisService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ecg")
@RequiredArgsConstructor
public class EcgController {

    private final EcgAnalysisService ecgAnalysisService;

    @PostMapping("/predict_window")
    public ResponseEntity<String> predictWindow(@RequestBody Map<String, Object> body) {
        if (body.get("x") == null) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\":\"Missing required field: x\"}");
        }
        @SuppressWarnings("unchecked")
        List<List<Double>> x = (List<List<Double>>) body.get("x");
        Integer fs = body.get("fs") instanceof Number n ? n.intValue() : 500;
        String result = ecgAnalysisService.analyzeEcg(x, fs);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(result);
    }

    @GetMapping("/sample_window")
    public ResponseEntity<String> sampleWindow(
            @RequestParam(required = false) String label) {
        String result = ecgAnalysisService.sampleWindow(label);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(result);
    }
}
