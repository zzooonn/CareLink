package com.example.demo.scheduler;

import com.example.demo.service.NewsAutoCollectorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class NewsAutoCollectorScheduler {

    private final NewsAutoCollectorService newsAutoCollectorService;

    @Scheduled(cron = "0 0 9 * * *") // 매일 09:00
    public void run() {
        log.info("[Scheduler] News auto collect start");
        newsAutoCollectorService.collectNewsFromUserDiseases();
        log.info("[Scheduler] News auto collect done");
    }
}
