FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    build-essential \
    libpcre3 \
    libpcre3-dev \
    openbabel \
    && rm -rf /var/lib/apt/lists/*

# Set up work directory
WORKDIR /app

# Copy requirements and install
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download Linux versions of Vina and Smina
RUN mkdir -p /app/bin && \
    wget https://github.com/ccsb-scripps/AutoDock-Vina/releases/download/v1.2.5/vina_1.2.5_linux_x86_64 -O /app/bin/vina && \
    wget https://github.com/gnina/smina/releases/download/v2020.12.10/smina.static -O /app/bin/smina && \
    chmod +x /app/bin/vina /app/bin/smina

# Copy the rest of the application
COPY --chown=user . .

# Set up user for Hugging Face (Running as user ID 1000)
RUN useradd -m -u 1000 user && \
    mkdir -p "/app/VI DOCK_Projects" && \
    chown -R user:user /app

USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONPATH=$PYTHONPATH:/app

# Use Hugging Face default port
EXPOSE 7860

# Run the application
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "7860"]
