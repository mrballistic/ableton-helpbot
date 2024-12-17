import { parentPort, workerData } from 'worker_threads';
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

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

    // Process chunks in smaller batches
    const processedChunks = chunks.map(chunk => ({
      pageContent: chunk.pageContent,
      metadata: chunk.metadata
    }));

    console.log(`Worker completed: Processed ${processedChunks.length} chunks`);
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
