# Hosting VI DOCK Pro 3.1 Backend on Hugging Face Spaces

This guide explains how to host the Python backend for VI DOCK Pro on Hugging Face Spaces using Docker.

## Prerequisites
- A Hugging Face account ([huggingface.co](https://huggingface.co))

## Step-by-Step Deployment

1. **Open your Terminal** (PowerShell or Command Prompt).
2. **Navigate to a folder** where you want to keep the Space code:
   ```powershell
   cd c:\Users\arjun\OneDrive\Desktop
   git clone https://huggingface.co/spaces/arjunSubbaraman/vi-dock-backend
   cd vi-dock-backend
   ```
3. **Copy your backend files** into this new `vi-dock-backend` folder:
   - Copy everything from your local `VI-DOCK/backend/` folder.
   - You can do this in File Explorer or via command line:
     ```powershell
     cp -r "C:\Users\arjun\OneDrive\Desktop\simdock_pro 3.1\VI-DOCK\backend\*" .
     ```
4. **Push to Hugging Face**:
   ```bash
   git add .
   git commit -m "Deploy VI DOCK Backend"
   git push
   ```

3. **Wait for Build**:
   - Hugging Face will automatically detect the `Dockerfile` and start building the container.
   - Once completed, the status will change to **Running**.

4. **Get Your API URL**:
   - Your API will be accessible at: `https://<your-username>-<your-space-name>.hf.space`
   - Test it by visiting the URL in your browser; you should see: `{"status": "online", "service": "VI DOCK Pro 3.1 API"}`

5. **Connect the Frontend**:
   - Copy the API URL.
   - In your frontend project, update the `VITE_API_BASE_URL` (usually in `.env` or `src/config.ts`) to this URL.

## Configuration (Optional)
- **CORS**: By default, the API allows all origins (`*`).
- **Storage**: Hugging Face Spaces use ephemeral storage by default. Files uploaded to `VI DOCK_Projects` will be lost if the Space restarts unless you enable **Persistent Storage** (requires a payment plan) or use a cloud database for results.

## Troubleshooting
- If the build fails, check the **Logs** tab in your Space.
- Ensure all Linux-specific binary paths in `config.json` are correct:
  - Vina: `/app/bin/vina`
  - OpenBabel: `obabel`
