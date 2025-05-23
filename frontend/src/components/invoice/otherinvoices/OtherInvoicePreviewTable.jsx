import React from 'react';
import PropTypes from 'prop-types';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';

const OtherInvoicePreviewTable = ({ data }) => {
  console.log('Preview Table Data:', data); // Log the table data

  if (!data || data.length === 0) {
    return <div>No data available</div>;
  }

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Load ID</TableCell>
            <TableCell>Permit No</TableCell>
            <TableCell>Weight Doc No</TableCell>
            <TableCell>Origin</TableCell>
            <TableCell>Destination</TableCell>
            <TableCell>Rate</TableCell>
            <TableCell>Unit Quantity</TableCell>
            <TableCell>Delivery Date</TableCell>
            <TableCell>Load Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.ID}>
              <TableCell>{row.ID}</TableCell>
              <TableCell>{row.LoadID}</TableCell>
              <TableCell>{row.PermitNo}</TableCell>
              <TableCell>{row.WeightDocNo}</TableCell>
              <TableCell>{row.Origin}</TableCell>
              <TableCell>{row.Destination}</TableCell>
              <TableCell>{row.Rate}</TableCell>
              <TableCell>{row.UnitQuantity}</TableCell>
              <TableCell>{row.DeliveryDate}</TableCell>
              <TableCell>{(row.Rate * row.UnitQuantity).toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

OtherInvoicePreviewTable.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      ID: PropTypes.string,
      LoadID: PropTypes.string,
      PermitNo: PropTypes.string,
      WeightDocNo: PropTypes.string,
      Origin: PropTypes.string,
      Destination: PropTypes.string,
      Rate: PropTypes.number,
      UnitQuantity: PropTypes.number,
      DeliveryDate: PropTypes.string
    })
  ).isRequired
};

export default OtherInvoicePreviewTable;
