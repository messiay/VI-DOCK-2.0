# Google Colab Backend Setup - VI DOCK 2.0

Follow these steps to run the backend on Google Colab.

## 1. Environment Setup

Run this cell to clone the repository and install dependencies.

```python
import os

# Clone or Update Repo
if not os.path.exists("/content/VI-DOCK-2.0"):
    !git clone https://github.com/messiay/VI-DOCK-2.0 /content/VI-DOCK-2.0
else:
    %cd /content/VI-DOCK-2.0
    !git pull

%cd /content/VI-DOCK-2.0/VI-DOCK/backend

# Install Python Dependencies
!pip install fastapi uvicorn[standard] pydantic python-multipart aiofiles --quiet
!pip install openmm pdbfixer mdtraj --quiet

# Install System Tools & Docking Engines (Compatible with Colab Linux)
!apt-get update -qq
!apt-get install -y openbabel autodock-vina --quiet 2>/dev/null

# Install Smina
!wget -q https://github.com/gnina/smina/releases/latest/download/smina.static -O /usr/local/bin/smina
!chmod +x /usr/local/bin/smina

# Link 'vina' if needed
!if ! command -v vina &> /dev/null; then ln -s $(command -v autodock-vina) /usr/local/bin/vina; fi

# Install Cloudlared
!wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared
!chmod +x /usr/local/bin/cloudflared

print("✅ Environment Ready")
```

## 2. Start Backend Server

Run this to start the FastAPI backend.

```python
import subprocess, sys, os

sys.path.insert(0, "/content/VI-DOCK-2.0/VI-DOCK/backend")
os.chdir("/content/VI-DOCK-2.0/VI-DOCK/backend")

# Kill previous instances
!pkill -f uvicorn
!pkill -f cloudflared

# Start Server
server = subprocess.Popen(
    ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT
)

import time; time.sleep(5)
print(f"✅ Backend started (PID {server.pid})")
```

## 3. Expose with Cloudflare Tunnel

Run this to get your public API URL. If the URL doesn't appear in 30 seconds, check the logs below manually.

```python
import subprocess, threading, time, re

tunnel_url = None

def run_tunnel():
    global tunnel_url
    proc = subprocess.Popen(
        ["/usr/local/bin/cloudflared", "tunnel", "--url", "http://localhost:8000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    print("Starting tunnel... logs will appear below:")
    for line in proc.stdout:
        print(line, end="") # Direct log feedback
        match = re.search(r"https://[\w-]+\.trycloudflare\.com", line)
        if match:
            tunnel_url = match.group(0)
            print(f"\n{'='*60}")
            print(f"✅ YOUR PUBLIC API URL: {tunnel_url}")
            print(f"{'='*60}")
            break

threading.Thread(target=run_tunnel, daemon=True).start()

# Wait for URL and show status
for i in range(30):
    if tunnel_url: break
    if i % 5 == 0: print(f"Waiting for tunnel... ({i}s)")
    time.sleep(1)

if not tunnel_url:
    print("\n⚠️ URL not detected automatically. Please check the logs above manually for a 'trycloudflare.com' link.")
```
