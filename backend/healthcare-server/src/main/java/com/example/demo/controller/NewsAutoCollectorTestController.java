package com.example.demo.controller;

import com.example.demo.entity.DiseaseTrend;
import com.example.demo.repository.DiseaseTrendRepository;
import com.example.demo.service.NewsAutoCollectorService;
import lombok.RequiredArgsConstructor;

import java.util.List;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/test/news-auto")
@RequiredArgsConstructor
public class NewsAutoCollectorTestController {

    private final NewsAutoCollectorService newsAutoCollectorService;
    private final DiseaseTrendRepository diseaseTrendRepository;
    
    @PostMapping("/run")
    public String run() {
        newsAutoCollectorService.collectNewsFromUserDiseases();
        return "OK - news auto collect executed";
    }

    @GetMapping("/trends")
    public List<DiseaseTrend> trends() {
        return diseaseTrendRepository.findAll();
    }

}
