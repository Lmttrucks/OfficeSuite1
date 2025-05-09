const sql = require('mssql');
const logger = require('../utils/logger'); // Import the logger utility
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: { encrypt: true },
};

const getCompanyID = async (companyName) => {
    const result = await sql.query`SELECT CompanyID FROM tblCompanies WHERE CompanyName = ${companyName}`;
    if (result.recordset.length === 0) {
        throw new Error(`Company not found: ${companyName}`);
    }
    return result.recordset[0].CompanyID;
};

const getCompanyName = async (companyID) => {
    if (!companyID) return null;
    const result = await sql.query`SELECT CompanyName FROM tblCompanies WHERE CompanyID = ${companyID}`;
    if (result.recordset.length === 0) {
        throw new Error(`Company not found: ${companyID}`);
    }
    return result.recordset[0].CompanyName;
};

const JobsDefaults = async (req, res) => {
    logger.log('Received: Get job defaults request with JobID:', req.params.jobID);
    const { jobID } = req.params;
    try {
        const result = await sql.query`
            SELECT DefaultOrigin, DefaultDestination, DefaultRate 
            FROM tblJobs 
            WHERE JobID = ${jobID}
            AND Void = 0`;

        if (result.recordset.length === 0) {
            logger.log('Sent: Job not found');
            return res.status(404).json({ message: 'Job not found' });
        }
        logger.log('Sent:', result.recordset[0]);
        res.json(result.recordset[0]);
    } catch (err) {
        logger.log('Error:', err.message);
        res.status(500).json({ message: 'Failed to fetch job defaults', error: err.message });
    }
};

const getAllJobs = async (req, res) => {
    logger.log('Received: Get all jobs request');
    try {
        await sql.connect(dbConfig);
        const result = await sql.query`SELECT * FROM tblJobs WHERE Void = 0`;
        logger.log('Sent:', result.recordset);
        res.json(result.recordset);
    } catch (err) {
        logger.log('Error:', err.message);
        res.status(500).json({ message: err.message });
    }
};

const getJobById = async (req, res) => {
    logger.log('Received: Get job by ID request with JobID:', req.params.jobID);
    const { jobID } = req.params;
    try {
        await sql.connect(dbConfig);
        const result = await sql.query`
            SELECT JobID, HarvestDate, FellingLicenseNo, ForestName, ForestOwner, FMCompanyID, FMContactID,
                   HarvestCompanyID, FWContactID, County, Town, FSC100, FSCCon, AccessType, GateLocation,
                   RoadCondition, EstSize, DefaultCompany, DefaultOrigin, DefaultDestination, DefaultRate,
                   PlantPassportLink, FellingLicenceLink, Comments, CleanUp, Started, Complete, UserID, DateAdded
            FROM tblJobs
            WHERE JobID = ${jobID} AND Void = 0`;

        if (result.recordset.length === 0) {
            logger.log('Sent: Job not found');
            return res.status(404).json({ message: 'Job not found' });
        }

        const job = result.recordset[0];
        job.FMCompanyName = await getCompanyName(job.FMCompanyID);
        job.HarvestCompanyName = await getCompanyName(job.HarvestCompanyID);

        logger.log('Sent:', job);
        res.json(job);
    } catch (err) {
        logger.log('Error:', err.message);
        res.status(500).json({ message: err.message });
    }
};

const createJob = async (req, res) => {
    logger.log('Received: Create job request with data:', req.body);
    const {
        JobID, HarvestDate, FellingLicenseNo, ForestName, ForestOwner, FMCompanyName, FMContactID,
        HarvestCompanyName, FWContactID, County, Town, FSC100, FSCCon, AccessType, GateLocation,
        RoadCondition, EstSize, DefaultCompany, DefaultOrigin, DefaultDestination, DefaultRate,
        PlantPassportLink, FellingLicenceLink, Comments, CleanUp, Started, Complete, UserID, DateAdded
    } = req.body;

    try {
        await sql.connect(dbConfig);
        const FMCompanyID = await getCompanyID(FMCompanyName);
        const HarvestCompanyID = await getCompanyID(HarvestCompanyName);

        await sql.query`
            INSERT INTO tblJobs (
                JobID, HarvestDate, FellingLicenseNo, ForestName, ForestOwner, FMCompanyID, FMContactID,
                HarvestCompanyID, FWContactID, County, Town, FSC100, FSCCon, AccessType, GateLocation,
                RoadCondition, EstSize, DefaultCompany, DefaultOrigin, DefaultDestination, DefaultRate,
                PlantPassportLink, FellingLicenceLink, Comments, CleanUp, Started, Complete, UserID, DateAdded
            ) VALUES (
                ${JobID}, ${HarvestDate}, ${FellingLicenseNo}, ${ForestName}, ${ForestOwner}, ${FMCompanyID}, ${FMContactID},
                ${HarvestCompanyID}, ${FWContactID}, ${County}, ${Town}, ${FSC100}, ${FSCCon}, ${AccessType}, ${GateLocation},
                ${RoadCondition}, ${EstSize}, ${DefaultCompany}, ${DefaultOrigin}, ${DefaultDestination}, ${DefaultRate},
                ${PlantPassportLink}, ${FellingLicenceLink}, ${Comments}, ${CleanUp}, ${Started}, ${Complete}, ${UserID}, ${DateAdded}
            )`;
        logger.log('Sent: Job created successfully');
        res.status(201).json({ message: 'Job created successfully' });
    } catch (err) {
        logger.log('Error:', err.message);
        res.status(500).json({ message: err.message });
    }
};

const updateJob = async (req, res) => {
    logger.log('Received: Update job request with JobID:', req.params.jobID, 'and data:', req.body);
    const { jobID } = req.params;
    const {
        JobID, HarvestDate, FellingLicenseNo, ForestName, ForestOwner, FMCompanyName, FMContactID,
        HarvestCompanyName, FWContactID, County, Town, FSC100, FSCCon, AccessType, GateLocation,
        RoadCondition, EstSize, DefaultCompany, DefaultOrigin, DefaultDestination, DefaultRate,
        PlantPassportLink, FellingLicenceLink, Comments, CleanUp, Started, Complete, UserID, DateAdded
    } = req.body;

    try {
        await sql.connect(dbConfig);
        const result = await sql.query`SELECT * FROM tblJobs WHERE JobID = ${jobID}`;
        if (result.recordset.length === 0) {
            logger.log('Sent: Job not found');
            return res.status(404).json({ message: 'Job not found' });
        }

        const FMCompanyID = await getCompanyID(FMCompanyName);
        const HarvestCompanyID = await getCompanyID(HarvestCompanyName);

        await sql.query`
            UPDATE tblJobs
            SET
                JobID = ${JobID},
                HarvestDate = ${HarvestDate},
                FellingLicenseNo = ${FellingLicenseNo},
                ForestName = ${ForestName},
                ForestOwner = ${ForestOwner},
                FMCompanyID = ${FMCompanyID},
                FMContactID = ${FMContactID},
                HarvestCompanyID = ${HarvestCompanyID},
                FWContactID = ${FWContactID},
                County = ${County},
                Town = ${Town},
                FSC100 = ${FSC100},
                FSCCon = ${FSCCon},
                AccessType = ${AccessType},
                GateLocation = ${GateLocation},
                RoadCondition = ${RoadCondition},
                EstSize = ${EstSize},
                DefaultCompany = ${DefaultCompany},
                DefaultOrigin = ${DefaultOrigin},
                DefaultDestination = ${DefaultDestination},
                DefaultRate = ${DefaultRate},
                PlantPassportLink = ${PlantPassportLink},
                FellingLicenceLink = ${FellingLicenceLink},
                Comments = ${Comments},
                CleanUp = ${CleanUp},
                Started = ${Started},
                Complete = ${Complete},
                UserID = ${UserID},
                DateAdded = ${DateAdded}
            WHERE JobID = ${jobID}`;
        logger.log('Sent: Job updated successfully');
        res.json({ message: 'Job updated successfully' });
    } catch (err) {
        logger.log('Error:', err.message);
        res.status(500).json({ message: err.message });
    }
};

const deleteJob = async (req, res) => {
    logger.log('Received: Delete job request with JobID:', req.params.jobID);
    const { jobID } = req.params;

    try {
        await sql.connect(dbConfig);
        const result = await sql.query`SELECT * FROM tblJobs WHERE JobID = ${jobID}`;
        if (result.recordset.length === 0) {
            logger.log('Sent: Job not found');
            return res.status(404).json({ message: 'Job not found' });
        }

        await sql.query`UPDATE tblJobs SET Void = 1 WHERE JobID = ${jobID}`;
        logger.log('Sent: Job deleted successfully');
        res.json({ message: 'Job deleted successfully' });
    } catch (err) {
        logger.log('Error:', err.message);
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    JobsDefaults,
    getAllJobs,
    getJobById,
    createJob,
    updateJob,
    deleteJob
};
