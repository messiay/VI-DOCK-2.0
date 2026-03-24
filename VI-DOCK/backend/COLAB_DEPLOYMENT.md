# Google Colab Backend Guide for VI DOCK Pro 3.1

This guide provides a single script to host your VI DOCK backend on Google Colab for free with **4 vCPUs** and high-speed docking.

## 1. Open Google Colab
Go to [colab.research.google.com](https://colab.research.google.com) and create a **New Notebook**.

## 2. Copy and Paste this Code
Copy the entire block below into the first cell of your Colab notebook and run it (Play button).

> [!IMPORTANT]
> **Copy ONLY the code between the lines.** Do NOT copy the triple backticks (```python) at the start or end.

```python
# === 1. Install System & Molecular Tools ===
print("Installing OpenBabel and system libraries...")
!apt-get update -qq
!apt-get install -y -qq openbabel libxrender1 libxext6 libgl1-mesa-glx > /dev/null

# === 2. Install Python Dependencies ===
print("Installing Python dependencies (FastAPI, RDKit, Meeko)...")
!pip install -q fastapi uvicorn[standard] python-multipart rdkit meeko requests httpx

# === 3. Clone the Project Code ===
import os
if not os.path.exists('simdock-pro'):
    print("Cloning the repository...")
    !git clone https://github.com/messiay/simdock-pro.git
else:
    print("Repository already exists. Updating...")
    %cd simdock-pro
    !git pull
    %cd ..

# Navigate to backend directory
os.chdir('/content/simdock-pro/VI-DOCK/backend')

# === 4. Download Vina and Smina Binaries ===
print("Downloading Vina and Smina...")
!mkdir -p bin
!wget -q https://github.com/ccsb-scripps/AutoDock-Vina/releases/download/v1.2.5/vina_1.2.5_linux_x86_64 -O bin/vina
!wget -q https://github.com/gnina/smina/releases/download/v2020.12.10/smina.static -O bin/smina
!chmod +x bin/vina bin/smina

# === 5. Setup Network Tunnel (Cloudflare - More Stable) ===
print("Downloading Cloudflare Tunnel...")
!wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
!chmod +x cloudflared-linux-amd64

# === 6. Start the API Server ===
import os
import subprocess
import time
import sys

def print_flush(text):
    print(text)
    sys.stdout.flush()

print_flush("\n--- Cleaning up previous runs ---")
os.system("pkill -f uvicorn")
os.system("pkill -f cloudflared")
time.sleep(2)

print_flush("\nStarting VI DOCK API Server on port 8123...")
# Start uvicorn in the background with nohup and save logs
os.system("nohup uvicorn api.main:app --host 0.0.0.0 --port 8123 > server.log 2>&1 &")

# Wait for server to be ready
time.sleep(5)

# Verify server is running (with a 5 second timeout so it never hangs)
verify_cmd = "curl -m 5 -s http://localhost:8123/ > /dev/null"
if os.system(verify_cmd) != 0:
    print_flush("⚠️ SERVER FAILED TO START! Checking logs...")
    os.system("cat server.log")
else:
    print_flush("✅ Server is running locally on port 8123")

# === 7. Expose it to the Web ===
print_flush("\n--- DEPLOYMENT COMPLETE ---")
print_flush("Starting Cloudflare secure tunnel...")

# Run Cloudflare in the background and save logs
os.system("nohup ./cloudflared-linux-amd64 tunnel --url http://127.0.0.1:8123 > cloudflare.log 2>&1 &")

time.sleep(5)

# Parse the log to find the URL
try:
    with open("cloudflare.log", "r") as f:
        log_content = f.read()
        import re
        url_match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', log_content)
        if url_match:
            print_flush("\n" + "="*50)
            print_flush(f"✅ YOUR PUBLIC API URL IS:\n{url_match.group(0)}")
            print_flush("="*50)
            print_flush("\n📋 Copy the link above and paste it into Vercel!")
        else:
            print_flush("\n⚠️ Still waiting for URL... Here are the recent logs:")
            os.system("cat cloudflare.log | tail -n 10")
except Exception as e:
    print_flush(f"Error reading Cloudflare log: {e}")

# Keep the cell running so the server stays alive
while True:
    time.sleep(60)
```

## 3. How to Connect
1.  When you run the script, look for the big box that says `✅ YOUR PUBLIC API URL IS:`
2.  **Update Frontend**: Copy that `.trycloudflare.com` URL (make sure not to include any extra spaces) and set it as your `VITE_API_BASE_URL` in Vercel or your local `.env` file.

## ⚠️ Important
Keep the Colab tab open. If the notebook disconnects, the backend will stop. You can reconnect and run the cell again at any time to get a new URL.
