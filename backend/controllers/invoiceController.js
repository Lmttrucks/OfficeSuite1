const sql = require('mssql');
const { BlobServiceClient } = require('@azure/storage-blob');
const logger = require('../utils/logger'); // Import the logger utility
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

exports.previewInvoice = async (req, res) => {
    logger.log('Received: Preview invoice request with data:', req.body);
    const { CompanyName, StartDate, EndDate, JobID, Purchase } = req.body;

    try {
        await sql.connect(dbConfig);

        const query = `
        SELECT 
            l.ID,
            l.DeliveryDate,
            l.JobID,
            l.PermitNo,
            l.WeightDocNo,
            l.Origin,
            l.Destination,
            l.Rate,
            l.UnitQuantity
        FROM tblLoads l
        INNER JOIN tblCompanies c ON l.CompanyID = c.CompanyID
        WHERE c.CompanyName = @CompanyName
          AND l.DeliveryDate BETWEEN @StartDate AND @EndDate
          AND l.InvoiceNo IS NULL
          AND l.Archived = 0
          AND l.Void = 0
          AND l.Purchase = @Purchase
          AND l.UnitQuantity > 0
          ${JobID ? 'AND l.JobID = @JobID' : ''}
        ORDER BY l.DeliveryDate`;

        const request = new sql.Request();
        request.input('CompanyName', sql.VarChar, CompanyName);
        request.input('StartDate', sql.Date, StartDate);
        request.input('EndDate', sql.Date, EndDate);
        request.input('Purchase', sql.Bit, Purchase);
        if (JobID) {
            request.input('JobID', sql.VarChar, JobID);
        }

        const loadsResult = await request.query(query);

        if (loadsResult.recordset.length === 0) {
            logger.log('Sent: No loads found for the specified criteria');
            return res.status(404).json({ message: 'No loads found for the specified criteria' });
        }

        logger.log('Sent:', loadsResult.recordset);
        res.json(loadsResult.recordset);
    } catch (err) {
        logger.log('Error:', err.message);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

exports.insertInvoice = async (req, res) => {
    logger.log('Received: Insert invoice request with data:', req.body);
    const { CompanyID, StartDate, EndDate, VatRate, LoadCount, PaymentAmount, InvoiceURL, UserID, Purchase } = req.body;

    try {
        await sql.connect(dbConfig);

        const result = await sql.query`
            INSERT INTO tblInvoice (
                CompanyID,
                StartDate,
                EndDate,
                VatRate,
                LoadCount,
                Generated,
                PaymentAmount,
                InvoiceURL,
                UserID,
                DateAdded,
                Purchase
            ) OUTPUT INSERTED.InvoiceNo
            VALUES (
                ${CompanyID},
                ${StartDate},
                ${EndDate},
                ${VatRate},
                ${LoadCount},
                GETDATE(),
                ${PaymentAmount},
                ${InvoiceURL},
                ${UserID},
                GETDATE(),
                ${Purchase}
            )`;

        const invoiceNo = result.recordset[0].InvoiceNo;

        logger.log('Sent: Invoice inserted successfully with InvoiceNo:', invoiceNo);
        res.status(201).json({ invoiceNo });
    } catch (err) {
        logger.log('Error:', err.message);
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

exports.getInvoicesByCompanyName = async (req, res) => {
    const { CompanyName } = req.query;

    try {
        await sql.connect(dbConfig);

        const result = await sql.query`
        SELECT 
            i.InvoiceNo,
            c.CompanyName,
            i.StartDate,
            i.EndDate,
            i.VatRate,
            i.LoadCount,
            i.PaymentAmount,
            i.InvoiceURL,
            i.UserID,
            i.DateAdded,
            i.Purchase
        FROM tblInvoice i
        INNER JOIN tblCompanies c ON i.CompanyID = c.CompanyID
        WHERE c.CompanyName = ${CompanyName} AND i.Void = 0`;

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'No invoices found for the specified company' });
        }

        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

exports.getLoadsByInvoiceNo = async (req, res) => {
    const { invoiceNo } = req.query;

    try {
        await sql.connect(dbConfig);

        const result = await sql.query`
        SELECT 
            l.ID,
            l.JobID,
            l.DeliveryDate,
            l.PermitNo,
            l.WeightDocNo,
            l.Origin,
            l.Destination,
            l.Rate,
            l.UnitQuantity
        FROM tblLoads l
        WHERE l.InvoiceNo = ${invoiceNo}
        AND l.Archived = 0
        AND l.Void = 0
        ORDER BY l.DeliveryDate`;

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'No loads found for the specified invoice number' });
        }

        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

exports.deleteInvoiceByInvoiceNo = async (req, res) => {
    logger.log('Received: Delete invoice request with InvoiceNo:', req.params.InvoiceNo);
    const { InvoiceNo } = req.params;

    try {
        await sql.connect(dbConfig);

        // Clear InvoiceNo from tblLoads
        await sql.query`
        UPDATE tblLoads
        SET InvoiceNo = NULL
        WHERE InvoiceNo = ${InvoiceNo}`;

        // Set the invoice to void in tblInvoice
        const result = await sql.query`
        UPDATE tblInvoice
        SET Void = 1
        WHERE InvoiceNo = ${InvoiceNo}`;

        if (result.rowsAffected[0] === 0) {
            logger.log('Sent: No invoice found for the specified invoice number');
            return res.status(404).json({ message: 'No invoice found for the specified invoice number' });
        }

        logger.log('Sent: Invoice deleted successfully');
        res.status(200).json({ message: 'Invoice deleted successfully' });
    } catch (err) {
        logger.log('Error:', err.message);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

exports.previewLinkedLoadsInvoice = async (req, res) => {
    const { CompanyName, StartDate, EndDate, Purchase } = req.body;

    try {
        await sql.connect(dbConfig);

        const loadsResult = await sql.query`
        SELECT 
            ll.ID,
            ll.LoadID,
            ll.Rate,
            l.PermitNo,
            l.WeightDocNo,
            l.Origin,
            l.Destination,
            l.UnitQuantity,
            l.DeliveryDate
        FROM tblLinkLoads ll
        INNER JOIN tblCompanies c ON ll.CompanyID = c.CompanyID
        INNER JOIN tblLoads l ON ll.LoadID = l.ID
        WHERE c.CompanyName = ${CompanyName}
          AND l.DeliveryDate BETWEEN ${StartDate} AND ${EndDate}
          AND l.Void = 0
          AND ll.Paid = 0
          AND ll.Void = 0
          AND ll.Purchase = ${Purchase}
          ORDER BY l.DeliveryDate`;

        if (loadsResult.recordset.length === 0) {
            return res.status(404).json({ message: 'No linked loads found for the specified company and date range' });
        }

        res.json(loadsResult.recordset);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

exports.getLast1000Invoices = async (req, res) => {
    try {
        await sql.connect(dbConfig);

        const result = await sql.query`
        SELECT TOP 1000 
            i.InvoiceNo,
            c.CompanyName,
            FORMAT(i.StartDate, 'dd-MM-yyyy') AS StartDate,
            FORMAT(i.EndDate, 'dd-MM-yyyy') AS EndDate,
            i.VatRate,
            i.LoadCount,
            i.PaymentAmount,
            i.InvoiceURL,
            i.UserID,
            FORMAT(i.DateAdded, 'dd-MM-yyyy') AS DateAdded,
            i.Purchase
        FROM tblInvoice i
        INNER JOIN tblCompanies c ON i.CompanyID = c.CompanyID
        WHERE i.Void = 0
        ORDER BY i.InvoiceNo DESC`;

        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

exports.updateInvoice = async (req, res) => {
    const { InvoiceNo } = req.params;
    const { CompanyName, StartDate, EndDate, VatRate, LoadCount, PaymentAmount, InvoiceURL, UserID, DateAdded, Purchase } = req.body;

    try {
        console.log('Incoming data:', req.body);
        console.log('InvoiceNo:', InvoiceNo);

        // Validate required fields
        if (!InvoiceNo || !CompanyName || !StartDate || !EndDate) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        await sql.connect(dbConfig);

        // Convert StartDate and EndDate from dd-MM-yyyy to yyyy-MM-dd
        const formatDate = (date) => {
            const [day, month, year] = date.split('-');
            return `${year}-${month}-${day}`;
        };

        const formattedStartDate = formatDate(StartDate);
        const formattedEndDate = formatDate(EndDate);

        console.log('Formatted StartDate:', formattedStartDate);
        console.log('Formatted EndDate:', formattedEndDate);

        // Get the CompanyID based on the CompanyName
        const companyResult = await sql.query`
        SELECT CompanyID FROM tblCompanies WHERE CompanyName = ${CompanyName}`;

        if (companyResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Company not found' });
        }

        const CompanyID = companyResult.recordset[0].CompanyID;
        console.log('CompanyID:', CompanyID);

        // Update the invoice in the database
        const result = await sql.query`
        UPDATE tblInvoice
        SET 
            CompanyID = ${CompanyID},
            StartDate = ${formattedStartDate},
            EndDate = ${formattedEndDate},
            VatRate = ${VatRate},
            LoadCount = ${LoadCount},
            PaymentAmount = ${PaymentAmount},
            InvoiceURL = ${InvoiceURL},
            UserID = ${UserID},
            DateAdded = ${DateAdded},
            Purchase = ${Purchase}
        WHERE InvoiceNo = ${InvoiceNo}`;

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'No invoice found for the specified invoice number' });
        }

        res.status(200).json({ message: 'Invoice updated successfully' });
    } catch (err) {
        console.error('Error updating invoice:', err.message);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};
