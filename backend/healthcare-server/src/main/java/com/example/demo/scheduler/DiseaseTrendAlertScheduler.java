package com.example.demo.scheduler;

import com.example.demo.service.DiseaseTrendAlertService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DiseaseTrendAlertScheduler {

    private final DiseaseTrendAlertService diseaseTrendAlertService;

    @Scheduled(cron = "0 0 9 * * *") // 매일 09:00
    public void runDaily() {
        log.info("[Scheduler] Disease trend alert job started");
        diseaseTrendAlertService.generateDiseaseTrendAlerts();
        log.info("[Scheduler] Disease trend alert job finished");
    }
}
