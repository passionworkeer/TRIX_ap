#!/usr/bin/env python3
"""
TRIX WebSocket Server - The "Hand" that executes commands
This server runs on your PC and receives commands from the mobile app.
"""

import asyncio
import json
import websockets
from typing import Set
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Store connected clients
connected_clients: Set[websockets.WebSocketServerProtocol] = set()


async def send_progress(websocket, progress: int, output: str):
    """Send progress update to client"""
    message = {
        "type": "progress",
        "progress": progress,
        "output": output,
        "timestamp": datetime.now().isoformat()
    }
    await websocket.send(json.dumps(message))
    logger.info(f"Sent progress: {progress}% - {output}")


async def send_success(websocket, message: str):
    """Send success message to client"""
    response = {
        "type": "success",
        "message": message,
        "timestamp": datetime.now().isoformat()
    }
    await websocket.send(json.dumps(response))
    logger.info(f"Sent success: {message}")


async def send_error(websocket, message: str):
    """Send error message to client"""
    response = {
        "type": "error",
        "message": message,
        "timestamp": datetime.now().isoformat()
    }
    await websocket.send(json.dumps(response))
    logger.error(f"Sent error: {message}")


async def execute_organize_files(websocket):
    """
    Mock execution of file organization task.
    In production, this would call OpenClaw or actual file operations.
    """
    logger.info("Starting file organization task...")
    
    steps = [
        (20, "Scanning desktop for files..."),
        (40, "Analyzing file types and categories..."),
        (60, "Creating organized folders..."),
        (80, "Moving files to appropriate locations..."),
        (100, "Finalizing organization...")
    ]
    
    for progress, output in steps:
        await send_progress(websocket, progress, output)
        await asyncio.sleep(0.6)  # Simulate work (3 seconds total)
    
    await send_success(websocket, "Successfully organized 42 files into 5 categories!")
    logger.info("File organization completed")


async def execute_clean_downloads(websocket):
    """Mock execution of downloads cleanup"""
    logger.info("Starting downloads cleanup task...")
    
    steps = [
        (25, "Scanning Downloads folder..."),
        (50, "Identifying old and duplicate files..."),
        (75, "Moving files to archive..."),
        (100, "Cleanup complete!")
    ]
    
    for progress, output in steps:
        await send_progress(websocket, progress, output)
        await asyncio.sleep(0.75)
    
    await send_success(websocket, "Cleaned up 128 MB of space in Downloads!")
    logger.info("Downloads cleanup completed")


async def execute_screenshot(websocket):
    """Mock screenshot capture"""
    logger.info("Taking screenshot...")
    
    await send_progress(websocket, 50, "Capturing screen...")
    await asyncio.sleep(0.5)
    await send_progress(websocket, 100, "Screenshot saved!")
    await asyncio.sleep(0.3)
    
    await send_success(websocket, "Screenshot saved to Desktop/Screenshots/")
    logger.info("Screenshot completed")


async def handle_command(websocket, data: dict):
    """Route commands to appropriate handlers"""
    command = data.get("command", "").lower()
    
    logger.info(f"Received command: {command}")
    
    # Command routing
    if command == "organize_files":
        await execute_organize_files(websocket)
    elif command == "clean_downloads":
        await execute_clean_downloads(websocket)
    elif command == "take_screenshot":
        await execute_screenshot(websocket)
    elif command == "ping":
        await send_success(websocket, "pong")
    else:
        await send_error(websocket, f"Unknown command: {command}")


async def handler(websocket):
    """Handle WebSocket connections"""
    client_address = websocket.remote_address
    logger.info(f"Client connected: {client_address}")
    
    # Add to connected clients
    connected_clients.add(websocket)
    
    # Send welcome message
    await websocket.send(json.dumps({
        "type": "status",
        "message": "Connected to TRIX Server",
        "timestamp": datetime.now().isoformat()
    }))
    
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                logger.info(f"Received from {client_address}: {data}")
                
                message_type = data.get("type")
                
                if message_type == "command":
                    await handle_command(websocket, data)
                else:
                    logger.warning(f"Unknown message type: {message_type}")
                    
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON: {e}")
                await send_error(websocket, "Invalid JSON format")
            except Exception as e:
                logger.error(f"Error handling message: {e}")
                await send_error(websocket, str(e))
                
    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client disconnected: {client_address}")
    finally:
        connected_clients.remove(websocket)


async def main():
    """Start the WebSocket server"""
    host = "0.0.0.0"  # Listen on all interfaces
    port = 8080
    
    logger.info(f"Starting TRIX WebSocket Server on {host}:{port}")
    logger.info("Waiting for connections from mobile app...")
    
    async with websockets.serve(handler, host, port):
        await asyncio.Future()  # Run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server shutdown requested")
    except Exception as e:
        logger.error(f"Server error: {e}")
