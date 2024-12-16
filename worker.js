import { parentPort, workerData } from 'worker_threads';
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";

async function processChunk() {
  const { pdfPath, startPage, endPage } = workerData;
  
  try {
    console.log(`Worker starting: Processing pages ${startPage}-${endPage}`);
    
    // Load PDF pages
    const loader = new PDFLoader(pdfPath, {
      splitPages: true,
      pageFilter: (pageNum) => pageNum >= startPage && pageNum <= endPage
    });

    const docs = await loader.load();
    console.log(`Loaded ${docs.length} pages from PDF`);
    
    // Split into chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const chunks = await splitter.splitDocuments(docs);
    console.log(`Created ${chunks.length} chunks`);

    // Initialize embeddings with lower concurrency for worker
    const embeddings = new OllamaEmbeddings({
      baseUrl: "http://localhost:11434",
      model: "mistral",
      maxConcurrency: 1, // Process one at a time in worker
      requestOptions: {
        timeout: 30000, // 30 second timeout
      }
    });

    // Process chunks in smaller batches to avoid overwhelming Ollama
    const batchSize = 5;
    const processedChunks = [];
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchTexts = batch.map(chunk => chunk.pageContent);
      
      console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(chunks.length / batchSize)}`);
      const batchEmbeddings = await embeddings.embedDocuments(batchTexts);
      
      batch.forEach((chunk, index) => {
        processedChunks.push({
          pageContent: chunk.pageContent,
          metadata: chunk.metadata,
          embedding: batchEmbeddings[index]
        });
      });
    }

    console.log(`Worker completed: Processed ${processedChunks.length} chunks with embeddings`);
    parentPort.postMessage({
      success: true,
      data: processedChunks
    });
  } catch (error) {
    console.error('Worker error:', error);
    parentPort.postMessage({
      success: false,
      error: error.message
    });
  }
}

processChunk().catch(error => {
  console.error('Worker fatal error:', error);
  parentPort.postMessage({
    success: false,
    error: error.message
  });
});
