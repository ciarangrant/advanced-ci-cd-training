// feedback round 2026-04-17 / FB-005-ENV — Prometheus instrumentation.
// Emits an "http_requests_total" counter per request so that the hackathon's
// PromQL success-rate expression (shared across all three sample services) can
// treat the Spring Boot service identically to the Node.js and FastAPI ones.
package com.hackathon.web;

import io.micrometer.core.instrument.MeterRegistry;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MetricsConfig {

    @Bean
    public FilterRegistrationBean<Filter> httpRequestsCounter(MeterRegistry registry) {
        Filter filter = new Filter() {
            @Override
            public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
                    throws IOException, ServletException {
                chain.doFilter(request, response);
                HttpServletRequest req = (HttpServletRequest) request;
                HttpServletResponse res = (HttpServletResponse) response;
                registry.counter(
                        "http_requests_total",
                        "method", req.getMethod(),
                        "route", req.getRequestURI(),
                        "status", Integer.toString(res.getStatus())
                ).increment();
            }
        };
        FilterRegistrationBean<Filter> reg = new FilterRegistrationBean<>(filter);
        reg.addUrlPatterns("/*");
        reg.setOrder(Integer.MIN_VALUE);
        return reg;
    }
}
