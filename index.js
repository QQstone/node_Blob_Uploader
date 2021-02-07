const express = require('express')
const multer = require('multer')
const _fs = require('fs')
const { StorageSharedKeyCredential,
    BlobServiceClient, blobService } = require('@azure/storage-blob')
const {AbortController} = require('@azure/abort-controller')
const app = express();

// init blob client
const STORAGE_ACCOUNT_NAME = '**********'
const CONTAINER_NAME = 'dcms'
const ACCOUNT_ACCESS_KEY ='******************************************************'
const ONE_MEGABYTE = 1024 * 1024;
const FOUR_MEGABYTES = 4 * ONE_MEGABYTE;
const ONE_MINUTE = 60 * 1000;
const aborter = AbortController.timeout(30 * ONE_MINUTE);
const credentials = new StorageSharedKeyCredential(STORAGE_ACCOUNT_NAME, ACCOUNT_ACCESS_KEY);

const blobServiceClient = new BlobServiceClient(`https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,credentials);

//app.use(bodyParser.urlencoded({ extended: false }));
const upload = multer({dest:'/uploads'})
app.post('/upload',upload.single('file'), async (req,res)=>{
    var des_file = __dirname + '/tmp/' +req.file.originalname;
    const stream = _fs.createReadStream(req.file.path)
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    const blobClient = containerClient.getBlobClient(req.file.originalname);
    const blockBlobClient = blobClient.getBlockBlobClient();
    const uploadOptions = {
        bufferSize: FOUR_MEGABYTES,
        maxBuffers: 5,
    };
    const result = await blockBlobClient.uploadStream(
        stream, 
        uploadOptions.bufferSize, 
        uploadOptions.maxBuffers,
        aborter);
    res.json(result)
})
app.get('/containerList', async (req, res)=>{
    const containerIterator = await blobServiceClient.listContainers()
    const list = []
    for await (var c of containerIterator){
        list.push(c)
    }
    res.json(list)
})
app.get('/blobList/:name', async (req, res)=>{
    const containerClient = blobServiceClient.getContainerClient(req.params.name);
    const list = [];
    const blobsIterator = await containerClient.listBlobsFlat()
    for await(var b of blobsIterator){
        list.push(b)
    }

    // const tree = {}
    // blobsGenerator = await containerClient.listBlobsByHierarchy('/',{ prefix: "example/" })
    // for await (const item of blobsGenerator) {
    //     if (item.kind === "prefix") {
    //       console.log(`\tBlobPrefix: ${item.name}`);
    //     } else {
    //       console.log(`\tBlobItem: name - ${item.name}, last modified - ${item.properties.lastModified}`);
    //     }
    //   }
    res.json(list)
})
async function streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      readableStream.on("data", (data) => {
        chunks.push(data instanceof Buffer ? data : Buffer.from(data));
      });
      readableStream.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      readableStream.on("error", reject);
    });
  }
app.get('/blob', async (req, res)=>{
    const containerName = req.query.containerName;
    const blobName = req.query.blobName;
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)
    const downloadResponse = await blockBlobClient.download(0)
    res.header('Content-Disposition', `attachment; filename="${blobName}"`);
    downloadResponse.readableStreamBody.pipe(res)
    // res.send(await streamToBuffer(downloadResponse.readableStreamBody))
})
app.get('/download', async (req, res)=>{
    // TODO stream from Azure Blob
    const listBlobsResponse = await containerClient.lisBlobFlatSegment();
    const treeBlobsResponse = await containerClient.listBlobsByHierarchy();
    // stream.pipe(res)
    res.end()
})
const port =process.env.PORT||3000;
app.listen(port,()=>{
    console.log('server on port:', port)
})