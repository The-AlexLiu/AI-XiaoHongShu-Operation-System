# Netflix Project Functional Test Plan

## 1. Introduction
This document outlines the comprehensive functional test plan for the Netflix Scraper and Content Generator project. The goal is to ensure all core functionalities, user interactions, and system performance meet the expected quality standards.

## 2. Test Environment
- **Backend**: FastAPI (Port 8000)
- **Frontend**: Vite + React (Port 5173)
- **Database/Storage**: Local CSV and File System
- **External Services**: OpenAI API (for notes), Netflix Website (for scraping)

## 3. Test Strategy
Testing will be performed manually and/or using automated scripts where applicable. The focus is on end-to-end user flows.

### 3.1 Scope
- **Core Functionality**: Scraping, Note Generation, Title Generation, Download.
- **User Interface**: Dashboard responsiveness, Form validation, Error feedback.
- **Performance**: Response times for long-running tasks.

## 4. Test Cases

### 4.1 Core Functionality Testing

| ID | Feature | Test Case Description | Input Data | Expected Result | Status |
|----|---------|-----------------------|------------|-----------------|--------|
| TC01 | Scraper | Run scraper with valid date range | Start: 2024-01-01, End: 2024-01-31 | Job starts, logs appear, finishes with "completed" status. Records added to CSV. | Pending |
| TC02 | Scraper | Run scraper with empty dates (default) | Start: (empty), End: (empty) | Scraper runs with default settings (likely recent data). | Pending |
| TC03 | Note Gen | Generate Xiaohongshu note from scraped data | (After TC01) Click "Generate Note" | AI generates a creative note with emojis and tags. | Pending |
| TC04 | Title Gen | Generate Title Image | Title: "Weekly Best", Range: "Jan 1-7" | Image generated and displayed. | Pending |
| TC05 | Download | Download all results | Click "Download Package" | ZIP file downloaded containing images and CSV. | Pending |

### 4.2 User Interaction & Edge Cases

| ID | Feature | Test Case Description | Input Data | Expected Result | Status |
|----|---------|-----------------------|------------|-----------------|--------|
| TC06 | UI | Verify Dashboard Loading | URL: http://localhost:5173 | Dashboard loads with all sections visible. | Pending |
| TC07 | Scraper | Invalid Date Range | Start: 2024-02-01, End: 2024-01-01 | Error message or handled gracefully (scraper might handle it). | Pending |
| TC08 | API | 404 Error Handling | Access /api/invalid | Returns 404 error. | Pending |
| TC09 | Note Gen | Generate note with no data | (Clear CSV first) Click "Generate Note" | Error message: "No movies found...". | Pending |

### 4.3 Performance Testing

| ID | Feature | Metric | Target | Actual |
|----|---------|--------|--------|--------|
| TC10 | Scraper | Time to scrape 1 week of data | < 60 seconds | TBD |
| TC11 | Note Gen | API Response Time | < 10 seconds | TBD |

## 5. Execution Log

*(This section will be populated as tests are executed)*

## 6. Bug Report

| Bug ID | Description | Severity | Reproduction Steps |
|--------|-------------|----------|--------------------|
| | | | |

## 7. Summary & Recommendations
*(To be filled after testing)*
