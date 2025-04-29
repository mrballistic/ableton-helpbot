#!/usr/bin/env python3
"""Test ChromaDB configuration options to diagnose server issues."""

import os
import sys
from chromadb.config import Settings

# Method 1: Using local API implementation (doesn't require a server)
def test_local_api():
    print("\n--- Testing with Local API Implementation ---")
    try:
        from chromadb import Client
        # Use local PersistentClient implementation
        client = Client(Settings(
            chroma_api_impl="chromadb.api.segment.SegmentAPI",
            persist_directory="./vector_store"
        ))
        print("✅ Successfully initialized ChromaDB client with local API")
        # Test creating a collection
        try:
            collection = client.get_or_create_collection("test_collection")
            print(f"✅ Successfully created/accessed test collection: {collection.name}")
            print(f"   Collection count: {collection.count()}")
            return True
        except Exception as e:
            print(f"❌ Error creating collection: {e}")
            return False
    except Exception as e:
        print(f"❌ Error initializing client: {e}")
        return False

# Method 2: Using HTTP client to connect to running server
def test_http_client():
    print("\n--- Testing with HTTP Client to Server ---")
    try:
        from chromadb import HttpClient
        # Connect to running server
        client = HttpClient(host="localhost", port=8000)
        print("✅ Successfully connected to ChromaDB server")
        # Test creating a collection
        try:
            collection = client.get_or_create_collection("test_collection")
            print(f"✅ Successfully created/accessed test collection: {collection.name}")
            print(f"   Collection count: {collection.count()}")
            return True
        except Exception as e:
            print(f"❌ Error creating collection: {e}")
            return False
    except Exception as e:
        print(f"❌ Error connecting to server: {e}")
        return False

# Method 3: Using FastAPI implementation with correct settings
def test_fastapi_with_host():
    print("\n--- Testing with FastAPI Implementation ---")
    try:
        from chromadb import Client
        # Use FastAPI implementation with server host
        client = Client(Settings(
            chroma_api_impl="chromadb.api.fastapi.FastAPI",
            chroma_server_host="localhost",
            chroma_server_http_port=8000,
            persist_directory="./vector_store"
        ))
        print("✅ Successfully initialized ChromaDB client with FastAPI")
        # Test creating a collection
        try:
            collection = client.get_or_create_collection("test_collection")
            print(f"✅ Successfully created/accessed test collection: {collection.name}")
            print(f"   Collection count: {collection.count()}")
            return True
        except Exception as e:
            print(f"❌ Error creating collection: {e}")
            return False
    except Exception as e:
        print(f"❌ Error initializing client: {e}")
        return False

if __name__ == "__main__":
    print("ChromaDB Diagnostic Tool")
    print(f"ChromaDB version: {sys.modules.get('chromadb').__version__ if 'chromadb' in sys.modules else 'Not imported'}")
    print(f"Python version: {sys.version}")
    
    # First try local API which doesn't need a server
    local_success = test_local_api()
    
    # Then try connecting to a running server
    http_success = test_http_client()
    
    # Finally try with the FastAPI implementation with correct settings
    fastapi_success = test_fastapi_with_host()
    
    print("\n--- Summary ---")
    print(f"Local API implementation: {'✅ Success' if local_success else '❌ Failed'}")
    print(f"HTTP client to server: {'✅ Success' if http_success else '❌ Failed'}")
    print(f"FastAPI with host config: {'✅ Success' if fastapi_success else '❌ Failed'}")
    
    if local_success:
        print("\nRECOMMENDATION: Use the Local API implementation (SegmentAPI) for direct access")
    elif http_success:
        print("\nRECOMMENDATION: Make sure the ChromaDB server is running and use the HttpClient")
    elif fastapi_success:
        print("\nRECOMMENDATION: Use FastAPI with proper host configuration")
    else:
        print("\nRECOMMENDATION: Review ChromaDB installation and configuration")
