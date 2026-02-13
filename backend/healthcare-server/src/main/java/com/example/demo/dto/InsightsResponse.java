package com.example.demo.dto;

import com.example.demo.entity.UserHealthRecord;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Insights 차트용 응답 DTO
 * - labels: 날짜 라벨 (7d면 "M,T..." 대신 "01/14" 같은 날짜를 주는 게 더 정확함)
 * - glucose/bp/ecg: 0~100 점수 배열 (days 길이로 고정)
 */
@Getter
@AllArgsConstructor
public class InsightsResponse {

    private List<String> labels;     // days 길이
    private List<Integer> glucose;   // days 길이 (0~100)
    private List<Integer> bp;        // days 길이 (0~100)
    private List<Integer> ecg;       // days 길이 (0~100)
    private int max;                 // 보통 100

    public static InsightsResponse from(List<UserHealthRecord> rows, int days) {

    LocalDate today = LocalDate.now();
    LocalDate startDay = today.minusDays(days - 1L);

    // ✅ 날짜별 "항목별 마지막 기록"을 따로 저장
    Map<LocalDate, UserHealthRecord> lastGlu = new HashMap<>();
    Map<LocalDate, UserHealthRecord> lastBp  = new HashMap<>();
    Map<LocalDate, UserHealthRecord> lastEcg = new HashMap<>();

    for (UserHealthRecord r : rows) {
        LocalDateTime t = r.getMeasuredAt();
        if (t == null) continue;
        LocalDate d = t.toLocalDate();
        if (d.isBefore(startDay) || d.isAfter(today)) continue;

        // 혈당 있는 기록이면 glucose용 last 갱신
        if (r.getGlucose() != null) {
            UserHealthRecord prev = lastGlu.get(d);
            if (prev == null || (prev.getMeasuredAt() != null && t.isAfter(prev.getMeasuredAt()))) {
                lastGlu.put(d, r);
            }
        }

        // 혈압 있는 기록이면 bp용 last 갱신
        if (r.getBpSys() != null && r.getBpDia() != null) {
            UserHealthRecord prev = lastBp.get(d);
            if (prev == null || (prev.getMeasuredAt() != null && t.isAfter(prev.getMeasuredAt()))) {
                lastBp.put(d, r);
            }
        }

        // ECG 있는 기록이면 ecg용 last 갱신 (riskScore 기준 추천)
        if (r.getEcgRiskScore() != null || Boolean.TRUE.equals(r.getEcgAbnormal()) || r.getHeartRate() != null) {
            UserHealthRecord prev = lastEcg.get(d);
            if (prev == null || (prev.getMeasuredAt() != null && t.isAfter(prev.getMeasuredAt()))) {
                lastEcg.put(d, r);
            }
        }
    }

    DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MM/dd");

    List<String> labels = new ArrayList<>(days);
    List<Integer> g = new ArrayList<>(days);
    List<Integer> b = new ArrayList<>(days);
    List<Integer> e = new ArrayList<>(days);

    for (int i = 0; i < days; i++) {
        LocalDate d = startDay.plusDays(i);
        labels.add(d.format(fmt));

        UserHealthRecord rg = lastGlu.get(d);
        UserHealthRecord rb = lastBp.get(d);
        UserHealthRecord re = lastEcg.get(d);

        g.add(scoreGlucose(rg != null ? rg.getGlucose() : null));
        b.add(scoreBp(
                rb != null ? rb.getBpSys() : null,
                rb != null ? rb.getBpDia() : null
        ));
        e.add(scoreEcg(
                re != null ? re.getEcgRiskScore() : null,
                re != null ? re.getEcgAbnormal() : null
        ));
    }

    return new InsightsResponse(labels, g, b, e, 100);
}


    // ------------------------
    // 점수 계산 로직(임시 버전)
    // 나중에 의료 기준/서비스 정책에 맞춰 조정하면 됨
    // ------------------------

    private static int scoreGlucose(Long glucose) {
        if (glucose == null) return 0;

        // 대략적인 예시: 90~140 최상, 멀어질수록 감점
        long ideal = 110;
        long diff = Math.abs(glucose - ideal);

        // diff 0 -> 100점, diff 100 -> 0점 근처
        int score = (int) Math.round(100 - diff * 1.0);
        return clamp(score);
    }

    private static int scoreBp(Long sys, Long dia) {
        if (sys == null || dia == null) return 0;

        long idealSys = 120;
        long idealDia = 80;

        long ds = Math.abs(sys - idealSys);
        long dd = Math.abs(dia - idealDia);

        // 대략적인 예시: 차이가 커질수록 감점
        double penalty = ds * 0.7 + dd * 1.0;
        int score = (int) Math.round(100 - penalty);
        return clamp(score);
    }

    private static int scoreEcg(Double riskScore, Boolean ecgAbnormal) {
        // riskScore가 있으면 그걸 최우선으로 점수화
        if (riskScore != null) {
            int score = (int) Math.round((1.0 - riskScore) * 100);
            return clamp(score);
        }

        // riskScore 없는데 abnormal만 true면 낮은 점수
        if (Boolean.TRUE.equals(ecgAbnormal)) return 20;

        // 데이터 없음
        return 0;
    }

    private static int clamp(int v) {
        if (v < 0) return 0;
        if (v > 100) return 100;
        return v;
    }
}
