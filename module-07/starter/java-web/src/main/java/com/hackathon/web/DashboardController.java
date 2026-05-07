package com.hackathon.web;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import java.lang.management.ManagementFactory;
import java.util.List;
import java.util.Map;

@Controller
public class DashboardController {

    @GetMapping("/")
    public String dashboard(Model model) {
        long uptimeMs = ManagementFactory.getRuntimeMXBean().getUptime();
        long uptimeSeconds = uptimeMs / 1000;

        List<Map<String, String>> items = List.of(
            Map.of("name", "Pipeline Config", "type", "YAML", "status", "Active"),
            Map.of("name", "Dockerfile", "type", "Docker", "status", "Active"),
            Map.of("name", "Terraform Plan", "type", "HCL", "status", "Pending")
        );

        model.addAttribute("uptime", uptimeSeconds);
        model.addAttribute("items", items);
        return "dashboard";
    }
}
