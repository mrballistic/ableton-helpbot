/**
 * Test Integration Script for Ableton Documentation Assistant
 * 
 * This script tests the integration between ChromaDB and LocalAI
 */

import fetch from 'node-fetch';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChromaClient } from 'chromadb';

// Configuration
const LOCALAI_URL = 'http://localhost:1234/v1';
const CHROMADB_URL = 'http://localhost:8000';
const API_URL = 'http://localhost:3000';
const COLLECTION_NAME = 'ableton_docs';

async function testLocalAI() {
  console.log('🧠 Testing LocalAI connection...');
  try {
    const response = await fetch(`${LOCALAI_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello, are you working properly?' }],
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ LocalAI is working properly!');
    console.log('📝 Response:', data.choices[0].message.content);
    return true;
  } catch (error) {
    console.error('❌ LocalAI test failed:', error.message);
    return false;
  }
}

async function testEmbeddings() {
  console.log('🔢 Testing embeddings generation via LocalAI...');
  try {
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: "sk-no-key-required-for-local",
      modelName: "text-embedding-3-small",
      basePath: LOCALAI_URL,
    });

    const result = await embeddings.embedQuery("Test embedding for Ableton Live");
    
    console.log('✅ Embeddings generation successful!');
    console.log(`📊 Vector dimensions: ${result.length}`);
    console.log(`🔢 First few values: ${result.slice(0, 5).join(', ')}`);
    return true;
  } catch (error) {
    console.error('❌ Embeddings test failed:', error.message);
    return false;
  }
}

async function testChromaDB() {
  console.log('🗄️ Testing ChromaDB connection...');
  try {
    const client = new ChromaClient({ path: CHROMADB_URL });
    const heartbeat = await client.heartbeat();
    
    console.log('✅ ChromaDB is running! Heartbeat:', heartbeat);
    
    // Check for our collection
    const collections = await client.listCollections();
    const abletonCollection = collections.find(c => c.name === COLLECTION_NAME);
    
    if (abletonCollection) {
      console.log(`✅ Found ${COLLECTION_NAME} collection`);
      const collection = await client.getCollection({ name: COLLECTION_NAME });
      const count = await collection.count();
      console.log(`📚 Collection has ${count} documents`);
    } else {
      console.log(`⚠️ No ${COLLECTION_NAME} collection found yet`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ ChromaDB test failed:', error.message);
    return false;
  }
}

async function testAPIEndpoints() {
  console.log('🌐 Testing API endpoints...');
  
  try {
    // Test health endpoint
    console.log('  Testing /api/health endpoint...');
    const healthResponse = await fetch(`${API_URL}/api/health`);
    const health = await healthResponse.json();
    console.log('  Health status:', health.status);
    
    // Test vector store stats
    console.log('  Testing /api/vectorstore/stats endpoint...');
    const statsResponse = await fetch(`${API_URL}/api/vectorstore/stats`);
    const stats = await statsResponse.json();
    console.log('  Vector store stats:', stats);
    
    return true;
  } catch (error) {
    console.error('❌ API endpoints test failed:', error.message);
    return false;
  }
}

async function testChatWithSimpleQuery() {
  console.log('💬 Testing chat endpoint with simple query...');
  
  try {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'What are MIDI effects in Ableton?',
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API error: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ Chat query successful!');
    console.log('📄 Response preview:', data.response.substring(0, 150) + '...');
    console.log(`📚 Retrieved ${data.context.length} context chunks`);
    
    return true;
  } catch (error) {
    console.error('❌ Chat query test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 Starting integration tests...');
  console.log('==============================');
  
  const localAIWorking = await testLocalAI();
  console.log('------------------------------');
  
  const embeddingsWorking = await testEmbeddings();
  console.log('------------------------------');
  
  const chromaDBWorking = await testChromaDB();
  console.log('------------------------------');
  
  const apiWorking = await testAPIEndpoints();
  console.log('------------------------------');
  
  // Only test the chat endpoint if everything else is working
  if (localAIWorking && embeddingsWorking && chromaDBWorking && apiWorking) {
    await testChatWithSimpleQuery();
    console.log('------------------------------');
  }
  
  console.log('==============================');
  console.log('🧪 Test summary:');
  console.log(`LocalAI: ${localAIWorking ? '✅ Working' : '❌ Failed'}`);
  console.log(`Embeddings: ${embeddingsWorking ? '✅ Working' : '❌ Failed'}`);
  console.log(`ChromaDB: ${chromaDBWorking ? '✅ Working' : '❌ Failed'}`);
  console.log(`API Endpoints: ${apiWorking ? '✅ Working' : '❌ Failed'}`);
  console.log('==============================');
}

// Run all tests
runAllTests().catch(console.error);