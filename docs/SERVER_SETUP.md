# TRIX Backend Server Setup

## Python Server Installation

### 1. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the WebSocket Server
```bash
python server.py
```

The server will start on `ws://0.0.0.0:8080` and listen for connections.

### 3. Testing the Connection
You can test the server with a simple client:
```python
import asyncio
import websockets
import json

async def test():
    async with websockets.connect('ws://localhost:8080') as ws:
        # Send a command
        await ws.send(json.dumps({
            "type": "command",
            "command": "organize_files"
        }))
        
        # Receive responses
        async for message in ws:
            print(json.loads(message))

asyncio.run(test())
```

### 4. Find Your PC's IP Address
To connect from a mobile device on the same network:

**Windows (PowerShell):**
```powershell
ipconfig | findstr IPv4
```

**Then update the WebSocket URL in your mobile app to:**
```
ws://YOUR_PC_IP:8080
```

## Available Commands

- `organize_files` - Organize desktop files
- `clean_downloads` - Clean up Downloads folder
- `take_screenshot` - Capture screen
- `ping` - Test connection

## Security Notes

⚠️ **Important**: This server is for LOCAL NETWORK use only. Do not expose it to the internet without proper authentication and encryption (WSS).

For production:
1. Add authentication tokens
2. Use WSS (WebSocket Secure) with SSL certificates
3. Implement rate limiting
4. Add IP whitelisting
