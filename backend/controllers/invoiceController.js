const sql = require('mssql');
const { BlobServiceClient } = require('@azure/storage-blob');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
    },
};

exports.previewOutInvoice = async (req, res) => {
    const { CompanyName, StartDate, EndDate } = req.body;

    try {
        await sql.connect(dbConfig);

        const loadsResult = await sql.query`
        SELECT 
            l.ID,
            l.JobID,
            l.PermitNo,
            l.WeightDocNo,
            l.Origin,
            l.Destination,
            l.Rate,
            l.UnitQuantity
        FROM tblLoads l
        INNER JOIN tblCompanies c ON l.CompanyID = c.CompanyID
        WHERE c.CompanyName = ${CompanyName}
          AND l.DeliveryDate BETWEEN ${StartDate} AND ${EndDate}
          AND l.OutgoingInvoiceNo IS NULL
          AND l.Archived = 0`;

        if (loadsResult.recordset.length === 0) {
            return res.status(404).json({ message: 'No loads found for the specified company and date range' });
        }

        res.json(loadsResult.recordset);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

exports.insertOutInvoice = async (req, res) => {
    const { CompanyID, StartDate, EndDate, VatRate, LoadCount, PaymentAmount, OutInvoiceURL, UserID } = req.body;

    try {
        await sql.connect(dbConfig);

        const result = await sql.query`
            INSERT INTO tblOutvoice (
                CompanyID,
                StartDate,
                EndDate,
                VatRate,
                LoadCount,
                Generated,
                PaymentAmount,
                OutInvoiceURL,
                UserID,
                DateAdded
            ) OUTPUT INSERTED.OutvoiceNo
            VALUES (
                ${CompanyID},
                ${StartDate},
                ${EndDate},
                ${VatRate},
                ${LoadCount},
                GETDATE(),
                ${PaymentAmount},
                ${OutInvoiceURL},
                ${UserID},
                GETDATE()
            )`;

        const outvoiceNo = result.recordset[0].OutvoiceNo;

        res.status(201).json({ outvoiceNo });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

exports.uploadInvoiceToBlob = async (req, res) => {
    const { file } = req;
    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINER_NAME);

    try {
        const blockBlobClient = containerClient.getBlockBlobClient(file.originalname);
        await blockBlobClient.uploadData(file.buffer);

        res.status(201).json({ message: 'Invoice uploaded successfully', url: blockBlobClient.url });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};
