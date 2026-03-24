# Google Colab All-in-One Deployment Guide

Copy the code below into a **SINGLE CELL** in your Google Colab notebook.

```python
# === 1. CLONE & SETUP ENVIRONMENT ===
import os, sys, subprocess, threading, time, re

print("🚀 Starting VI DOCK 2.0 All-in-One Setup...")

# Fresh Clone
if os.path.exists("/content/VI-DOCK-2.0"):
    !rm -rf /content/VI-DOCK-2.0
!git clone https://github.com/messiay/VI-DOCK-2.0 /content/VI-DOCK-2.0

# Dynamically Find Backend Directory
def find_backend():
    for root, dirs, files in os.walk('/content/VI-DOCK-2.0'):
        if 'api' in dirs and 'core' in dirs and 'main.py' in os.listdir(os.path.join(root, 'api')):
            return root
    return None

backend_path = find_backend()
if not backend_path:
    print("❌ ERROR: Could not find backend directory in the repository!")
    sys.exit(1)

print(f"✅ Found backend at: {backend_path}")
os.chdir(backend_path)
sys.path.insert(0, backend_path)

# === 2. INSTALL DEPENDENCIES ===
print("📦 Installing dependencies (this may take 2-3 minutes)...")
!apt-get update -qq && apt-get install -y openbabel autodock-vina -qq > /dev/null
!pip install fastapi uvicorn[standard] pydantic python-multipart aiofiles openmm pdbfixer mdtraj --quiet

# Install Smina
!wget -q https://github.com/gnina/smina/releases/latest/download/smina.static -O /usr/local/bin/smina
!chmod +x /usr/local/bin/smina

# Link 'vina' command
!if ! command -v vina &> /dev/null; then ln -s $(command -v autodock-vina) /usr/local/bin/vina; fi

# Install Cloudflared
!wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared
!chmod +x /usr/local/bin/cloudflared

# === 3. START SERVER & TUNNEL ===
print("🔌 Starting Server and Tunnel...")
!pkill -f uvicorn
!pkill -f cloudflared

# Start FastAPI in background
server_proc = subprocess.Popen(
    ["uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", "8000"],
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
)

tunnel_url = None
def monitor_tunnel():
    global tunnel_url
    tunnel_proc = subprocess.Popen(
        ["/usr/local/bin/cloudflared", "tunnel", "--url", "http://127.0.0.1:8000"],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
    )
    for line in tunnel_proc.stdout:
        match = re.search(r"https://[\w-]+\.trycloudflare\.com", line)
        if match:
            tunnel_url = match.group(0)
            break

threading.Thread(target=monitor_tunnel, daemon=True).start()

print("⏳ Waiting for public URL...")
for _ in range(30):
    if tunnel_url: break
    time.sleep(1)

if tunnel_url:
    print("\n" + "="*60)
    print(f"✅ SUCCESS! YOUR API URL IS:\n\n{tunnel_url}\n")
    print("Paste this into your VI-DOCK frontend settings.")
    print("="*60)
else:
    print("⚠️ Tunnel URL not detected automatically. Please check logs manually.")

# Keep cell alive
while True:
    time.sleep(60)
```
