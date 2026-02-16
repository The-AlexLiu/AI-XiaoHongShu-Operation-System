# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install system dependencies for Playwright and Node.js
# We need Node.js to build the frontend
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
WORKDIR /app
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install uvicorn

# Install Playwright browsers
RUN playwright install --with-deps chromium

# Copy the rest of the application
COPY . /app/

# Build Frontend
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Go back to root
WORKDIR /app

# Create directory for images/storage
RUN mkdir -p images

# Expose port
EXPOSE 8000

# Command to run the application
# We use uvicorn to run the app
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
