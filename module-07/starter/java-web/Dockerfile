# Build stage
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY pom.xml .
COPY .mvn .mvn
COPY mvnw .
RUN chmod +x mvnw && ./mvnw dependency:resolve
COPY src ./src
RUN ./mvnw package -DskipTests

# TODO: Add the runtime stage
# Requirements:
# - Use eclipse-temurin:21-jre-alpine as the base image
# - Copy the built JAR from the build stage (target/*.jar)
# - EXPOSE port 8080
# - Install curl (apk add --no-cache curl) for the health check
# - Add a HEALTHCHECK instruction that tests http://localhost:8080/actuator/health
#   Use --start-period=60s to account for JVM warmup
# - Set CMD to run the JAR with java -jar
